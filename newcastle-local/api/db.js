const { normalizeDB } = require("../server");
const { readState, writeState, readBody, sendJSON, handleError } = require("../lib/supabase-store");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const payload = await readState();
      return sendJSON(res, 200, { payload: JSON.stringify(payload) }, req.method);
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (error) {
        if (error.status) throw error;
        const invalid = new Error("So'rov JSON formatida bo'lishi kerak");
        invalid.status = 400;
        throw invalid;
      }
      if (!body || typeof body.payload !== "string") {
        const error = new Error("payload matn ko'rinishida yuborilishi kerak");
        error.status = 400;
        throw error;
      }

      let parsed;
      try {
        parsed = JSON.parse(body.payload);
      } catch {
        const error = new Error("payload ichidagi baza JSON formati noto'g'ri");
        error.status = 400;
        throw error;
      }
      const normalized = normalizeDB(parsed);
      await writeState(normalized);
      return sendJSON(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, HEAD, PUT");
    return sendJSON(res, 405, { ok: false, error: "Metod ruxsat etilmagan" }, req.method);
  } catch (error) {
    return handleError(res, error, req.method);
  }
};
