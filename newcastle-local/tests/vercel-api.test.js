const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-secret";
const dbHandler = require("../api/db");
const healthHandler = require("../api/health");

let state;
let requests;

function supabaseMock(url, options = {}) {
  requests.push({ url, options });
  const requestURL = new URL(url);
  assert.ok(requestURL.pathname.startsWith("/rest/v1/app_state"));
  assert.equal(options.headers.apikey, "test-secret");

  if (requestURL.search.includes("select=payload")) {
    return Promise.resolve(new Response(JSON.stringify(state ? [{ payload: state }] : []), { status: 200 }));
  }
  if (requestURL.search.includes("select=id")) {
    return Promise.resolve(new Response(JSON.stringify(state ? [{ id: "main" }] : []), { status: 200 }));
  }
  if (options.method === "POST") {
    const body = JSON.parse(options.body);
    const merge = options.headers.Prefer.includes("merge-duplicates");
    if (!state || merge) state = body.payload;
    return Promise.resolve(new Response(null, { status: 201 }));
  }
  return Promise.resolve(new Response("Not found", { status: 404 }));
}

function request(method, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  return req;
}

function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body || ""; this.finished = true; },
  };
}

test.beforeEach((context) => {
  state = null;
  requests = [];
  context.mock.method(globalThis, "fetch", supabaseMock);
});

test("Vercel GET birinchi marta demo bazani Supabase ga joylaydi", async () => {
  const res = response();
  await dbHandler(request("GET"), res);
  assert.equal(res.statusCode, 200);
  const result = JSON.parse(res.body);
  assert.equal(JSON.parse(result.payload).users.length, 52);
  assert.equal(state.users.length, 52);
  assert.ok(requests.some((item) => item.options.method === "POST"));
});

test("Vercel PUT bazani doimiy saqlaydi", async () => {
  const first = response();
  await dbHandler(request("GET"), first);
  const db = JSON.parse(JSON.parse(first.body).payload);
  db.messages.push({ id: "vercel-test", text: "Saqlandi" });

  const saved = response();
  await dbHandler(request("PUT", { payload: JSON.stringify(db) }), saved);
  assert.equal(saved.statusCode, 200, saved.body);
  assert.ok(state.messages.some((message) => message.id === "vercel-test"));

  const loaded = response();
  await dbHandler(request("GET"), loaded);
  const payload = JSON.parse(JSON.parse(loaded.body).payload);
  assert.ok(payload.messages.some((message) => message.id === "vercel-test"));
});

test("Vercel API noto'g'ri ma'lumotni rad etadi", async () => {
  const res = response();
  await dbHandler(request("PUT", { payload: JSON.stringify({ users: "xato" }) }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).ok, false);
});

test("Vercel health Supabase ulanishini tekshiradi", async () => {
  const res = response();
  await healthHandler(request("GET"), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, service: "newcastle-school", storage: "supabase" });
});
