// Newcastle School — qo'shimcha paketlarsiz Node.js server (Node 18+).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SEED_FILE = path.join(__dirname, "data", "demo-data.json");
const MAX_BODY_SIZE = 25 * 1024 * 1024; // Fayl biriktirmalari uchun 25 MB.

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const COLLECTIONS = [
  "users",
  "homework",
  "submissions",
  "grades",
  "examTopics",
  "shopItems",
  "purchases",
  "groups",
  "payments",
  "paymentRequests",
  "supportSlots",
  "mainAttendance",
  "notifications",
  "messages",
];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDB(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError(400, "Baza obyekt bo'lishi kerak");
  }
  if (!Array.isArray(value.users)) {
    throw httpError(400, "Bazada users ro'yxati topilmadi");
  }
  for (const key of COLLECTIONS) {
    if (value[key] === undefined || value[key] === null) value[key] = [];
    if (!Array.isArray(value[key])) {
      throw httpError(400, `${key} ro'yxat bo'lishi kerak`);
    }
  }
  return value;
}

function readDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.copyFileSync(SEED_FILE, DB_FILE); // Birinchi ishga tushirishda demo ma'lumot.
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    throw httpError(500, "data/db.json buzilgan. Faylni tekshiring yoki demo ma'lumotni tiklang");
  }
  try {
    return JSON.stringify(normalizeDB(parsed));
  } catch (error) {
    if (error.status === 400) error.status = 500;
    throw error;
  }
}

function writeDB(text) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, DB_FILE); // Atomik yozish — yarim yozilgan fayl qolmaydi.
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

function setCommonHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
}

function sendJSON(res, status, value, method = "GET") {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(method === "HEAD" ? undefined : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(httpError(413, "So'rov hajmi 25 MB dan oshmasligi kerak"));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  setCommonHeaders(res);

  let pathname;
  try {
    const url = new URL(req.url, "http://localhost");
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw httpError(400, "URL formati noto'g'ri");
  }
  if (pathname.includes("\0")) throw httpError(400, "URL formati noto'g'ri");

  if (pathname === "/api/health") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return sendJSON(res, 405, { ok: false, error: "Metod ruxsat etilmagan" });
    }
    return sendJSON(res, 200, { ok: true, service: "newcastle-school" }, req.method);
  }

  if (pathname === "/api/db") {
    if (req.method === "GET" || req.method === "HEAD") {
      return sendJSON(res, 200, { payload: readDB() }, req.method);
    }
    if (req.method === "PUT") {
      const contentLength = Number(req.headers["content-length"] || 0);
      if (contentLength > MAX_BODY_SIZE) {
        req.resume();
        throw httpError(413, "So'rov hajmi 25 MB dan oshmasligi kerak");
      }

      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (error) {
        if (error.status) throw error;
        throw httpError(400, "So'rov JSON formatida bo'lishi kerak");
      }
      if (!body || typeof body.payload !== "string") {
        throw httpError(400, "payload matn ko'rinishida yuborilishi kerak");
      }

      let parsed;
      try {
        parsed = JSON.parse(body.payload);
      } catch {
        throw httpError(400, "payload ichidagi baza JSON formati noto'g'ri");
      }
      const normalized = normalizeDB(parsed);
      writeDB(JSON.stringify(normalized));
      return sendJSON(res, 200, { ok: true });
    }
    res.setHeader("Allow", "GET, HEAD, PUT");
    return sendJSON(res, 405, { ok: false, error: "Metod ruxsat etilmagan" }, req.method);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJSON(res, 405, { ok: false, error: "Metod ruxsat etilmagan" }, req.method);
  }

  // path.resolve + chegara tekshiruvi katalog tashqarisiga chiqishni oldini oladi.
  let file = path.resolve(PUBLIC, `.${pathname}`);
  if (file !== PUBLIC && !file.startsWith(`${PUBLIC}${path.sep}`)) {
    throw httpError(403, "Ruxsat etilmagan fayl yo'li");
  }

  let stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (stat?.isDirectory()) {
    file = path.join(file, "index.html");
    stat = fs.existsSync(file) ? fs.statSync(file) : null;
  }

  // Faqat sahifa marshrutlari uchun SPA fallback; yetishmagan asset 404 qaytaradi.
  if (!stat) {
    const acceptsHTML = (req.headers.accept || "").includes("text/html");
    if (!path.extname(pathname) && acceptsHTML) {
      file = path.join(PUBLIC, "index.html");
      stat = fs.statSync(file);
    } else {
      return sendJSON(res, 404, { ok: false, error: "Fayl topilmadi" }, req.method);
    }
  }

  const isHTML = path.extname(file) === ".html";
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": isHTML ? "no-cache" : "public, max-age=3600",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

function createServer() {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      const status = error.status || 500;
      if (status >= 500) console.error("Server xatosi:", error.message);
      if (!res.headersSent) {
        sendJSON(res, status, { ok: false, error: error.message || "Server xatosi" }, req.method);
      } else {
        res.destroy();
      }
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  return server;
}

if (require.main === module) {
  if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
    console.error("PORT 0–65535 oralig'idagi butun son bo'lishi kerak");
    process.exit(1);
  }
  createServer().listen(PORT, HOST, () => {
    console.log(`Newcastle School ishga tushdi: http://${HOST}:${PORT}`);
    console.log("To'xtatish: Ctrl+C");
  });
}

module.exports = { createServer, normalizeDB };
