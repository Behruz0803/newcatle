const SEED = require("../data/demo-data.json");

const STATE_ID = "main";
const MAX_BODY_SIZE = 4 * 1024 * 1024;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const error = new Error("Supabase sozlamalari serverda kiritilmagan");
    error.status = 503;
    throw error;
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function supabase(pathname, options = {}) {
  const { url, key } = config();
  let response;
  try {
    response = await fetch(`${url}/rest/v1/${pathname}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch {
    const error = new Error("Doimiy bazaga ulanib bo'lmadi");
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const details = await response.text();
    console.error("Supabase API xatosi:", response.status, details.slice(0, 500));
    const error = new Error("Doimiy baza so'rovini bajarib bo'lmadi");
    error.status = 502;
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readState() {
  const rows = await supabase(`app_state?id=eq.${STATE_ID}&select=payload`);
  if (rows.length) return rows[0].payload;

  // Birinchi marta ochilganda demo bazani doimiy bazaga nusxalaymiz.
  await supabase("app_state", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ id: STATE_ID, payload: SEED }),
  });
  const seeded = await supabase(`app_state?id=eq.${STATE_ID}&select=payload`);
  if (!seeded.length) throw new Error("Boshlang'ich baza yaratib bo'lmadi");
  return seeded[0].payload;
}

async function writeState(payload) {
  await supabase("app_state", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: STATE_ID,
      payload,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function checkState() {
  await supabase("app_state?select=id&limit=1");
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      const error = new Error("So'rov hajmi 4 MB dan oshmasligi kerak");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJSON(res, status, value, method = "GET") {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(method === "HEAD" ? undefined : body);
}

function handleError(res, error, method) {
  const status = error.status || 500;
  if (status >= 500) console.error("API xatosi:", error.message);
  sendJSON(res, status, { ok: false, error: error.message || "Server xatosi" }, method);
}

module.exports = { readState, writeState, checkState, readBody, sendJSON, handleError };
