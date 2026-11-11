const { checkState, sendJSON, handleError } = require("../lib/supabase-store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return sendJSON(res, 405, { ok: false, error: "Metod ruxsat etilmagan" }, req.method);
    }
    await checkState();
    return sendJSON(res, 200, { ok: true, service: "newcastle-school", storage: "supabase" }, req.method);
  } catch (error) {
    return handleError(res, error, req.method);
  }
};
