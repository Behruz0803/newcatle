const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newcastle-test-"));
process.env.DATA_DIR = dataDir;
const { createServer, normalizeDB } = require("../server");

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("health endpoint GET va HEAD ishlaydi", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "newcastle-school" });

  const head = await fetch(`${base}/api/health`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("bosh sahifa, statik fayllar va SPA marshrutlari ochiladi", async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /text\/html/);
  assert.match(await index.text(), /Newcastle School/);

  const script = await fetch(`${base}/assets/index-DKwGrC2V.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /text\/javascript/);
  assert.ok(Number(script.headers.get("content-length")) > 1_000_000);

  const route = await fetch(`${base}/dashboard`, { headers: { Accept: "text/html" } });
  assert.equal(route.status, 200);
  assert.match(await route.text(), /id="root"/);
});

test("yetishmagan asset 404, noto'g'ri URL 400, traversal 403 qaytaradi", async () => {
  const missing = await fetch(`${base}/assets/missing.js`, { headers: { Accept: "text/html" } });
  assert.equal(missing.status, 404);

  const malformed = await fetch(`${base}/%E0%A4%A`);
  assert.equal(malformed.status, 400);

  const traversal = await fetch(`${base}/..%2fserver.js`);
  assert.equal(traversal.status, 403);
});

test("demo baza avtomatik yaratiladi va API orqali o'qiladi", async () => {
  const response = await fetch(`${base}/api/db`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { payload } = await response.json();
  const db = JSON.parse(payload);
  assert.equal(db.users.length, 52);
  assert.equal(db.groups.length, 5);
  assert.ok(Array.isArray(db.messages));
  assert.ok(fs.existsSync(path.join(dataDir, "db.json")));
});

test("PUT bazani saqlaydi va keyingi GET da saqlangan ma'lumot qaytadi", async () => {
  const original = await (await fetch(`${base}/api/db`)).json();
  const db = JSON.parse(original.payload);
  db.messages.push({
    id: "server-test-message",
    senderId: "student1",
    receiverId: "admin",
    text: "Server testi",
    sentAt: new Date().toISOString(),
    read: false,
  });

  const saved = await fetch(`${base}/api/db`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify(db) }),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ok: true });

  const loaded = await (await fetch(`${base}/api/db`)).json();
  const stored = JSON.parse(loaded.payload);
  assert.ok(stored.messages.some((message) => message.id === "server-test-message"));
});

test("buzilgan JSON va noto'g'ri baza tuzilmasi 400 qaytaradi", async () => {
  const malformed = await fetch(`${base}/api/db`, { method: "PUT", body: "{" });
  assert.equal(malformed.status, 400);

  const invalidPayload = await fetch(`${base}/api/db`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: "not-json" }),
  });
  assert.equal(invalidPayload.status, 400);

  const invalidDB = await fetch(`${base}/api/db`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify({ users: {}, messages: [] }) }),
  });
  assert.equal(invalidDB.status, 400);

  const stillWorking = await fetch(`${base}/api/db`);
  assert.equal(stillWorking.status, 200);
});

test("ruxsat etilmagan metod 405 va Allow sarlavhasini qaytaradi", async () => {
  const response = await fetch(`${base}/api/db`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD, PUT");
});

test("25 MB dan katta so'rov 413 bilan rad etiladi", async () => {
  const status = await new Promise((resolve, reject) => {
    const url = new URL(base);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: "/api/db",
        method: "PUT",
        headers: { "Content-Type": "application/json", "Content-Length": 25 * 1024 * 1024 + 1 },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 413);
});

test("eski bazadagi yetishmagan ro'yxatlar avtomatik to'ldiriladi", () => {
  const migrated = normalizeDB({ users: [] });
  assert.ok(Array.isArray(migrated.messages));
  assert.ok(Array.isArray(migrated.mainAttendance));
  assert.throws(() => normalizeDB({ users: [], messages: "xato" }), /ro'yxat/);
});
