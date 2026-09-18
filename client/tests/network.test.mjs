import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NEXT_PUBLIC_API_URL = "https://coderepair.onrender.com/";
const { resolveBackendUrl, requestApi, subscribeToRun } = await import("../lib/api.js");
const { parseIssueRequest } = await import("../lib/issueRequest.js");

test("production requires configuration and rejects localhost on deployed pages", () => {
  assert.throws(() => resolveBackendUrl("", "production"), /configuration missing/);
  assert.throws(() => resolveBackendUrl("http://localhost:8000", "production", "https://frontend.example"), /localhost API URL/);
  assert.equal(resolveBackendUrl("", "development", "http://localhost:3000"), "http://localhost:8000");
});

test("normalize URL and prevent mixed content, API prefix and credential mistakes", () => {
  assert.equal(resolveBackendUrl(" https://coderepair.onrender.com/// ", "production"), "https://coderepair.onrender.com");
  assert.throws(() => resolveBackendUrl("http://api.example", "production", "https://frontend.example"), /HTTPS backend/);
  for (const url of ["https://api.example/api", "https://key@api.example", "https://api.example/?token=secret", "file:///etc"]) {
    assert.throws(() => resolveBackendUrl(url, "production"));
  }
});

test("parse issue links and repository plus issue requests", () => {
  assert.deepEqual(parseIssueRequest("Please fix https://github.com/owner/repo/issues/25"), { repo_url: "https://github.com/owner/repo", issue: "25" });
  assert.deepEqual(parseIssueRequest("https://github.com/owner/repo.git\nissue 25"), { repo_url: "https://github.com/owner/repo", issue: "25" });
  assert.throws(() => parseIssueRequest("Tell me a joke"), /Paste a GitHub issue/);
  assert.throws(() => parseIssueRequest("https://evil.example/owner/repo/issues/25"));
});

test("requests use the configured deployed URL and retain request payloads", async (context) => {
  context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://coderepair.onrender.com/api/runs");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { issue: "25" });
    return new Response(JSON.stringify({ run_id: "run-1" }), { status: 202 });
  });
  assert.deepEqual(await requestApi("/api/runs", { issue: "25" }), { run_id: "run-1" });
});

test("errors distinguish network, HTTP authentication and non-JSON deployments", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => { throw new TypeError("network"); });
  await assert.rejects(requestApi("/api/health"), /Network or CORS/);
  fetchMock.mock.mockImplementation(async () => new Response('{"detail":"Invalid token"}', { status: 401 }));
  await assert.rejects(requestApi("/api/health"), /Authentication failed.*401/);
  fetchMock.mock.mockImplementation(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(requestApi("/api/health"), /502.*non-JSON/);
  fetchMock.mock.mockImplementation(async () => new Response('{"detail":"Unavailable"}', { status: 500 }));
  await assert.rejects(requestApi("/api/health"), /Backend server error.*500/);
});

test("SSE uses the same backend, forwards actual snapshots, reconnects and closes", (context) => {
  let stream;
  const originalEventSource = globalThis.EventSource;
  context.after(() => {
    if (originalEventSource === undefined) delete globalThis.EventSource;
    else globalThis.EventSource = originalEventSource;
  });
  globalThis.EventSource = class {
    constructor(url) { this.url = url; this.closed = false; stream = this; }
    close() { this.closed = true; }
  };
  const received = [];
  const statuses = [];
  const unsubscribe = subscribeToRun("run-1", (event) => received.push(event), (status) => statuses.push(status));
  assert.equal(stream.url, "https://coderepair.onrender.com/api/runs/run-1/events");
  stream.onopen();
  const waitingEvent = { id: 1, node: "approval", state: { status: "awaiting_approval" } };
  stream.onmessage({ data: JSON.stringify(waitingEvent) });
  assert.deepEqual(received[0], waitingEvent);
  assert.equal(stream.closed, false);
  stream.onerror();
  assert.equal(statuses.at(-1), "Reconnecting…");
  stream.onmessage({ data: JSON.stringify({ id: 2, state: { status: "completed" } }) });
  assert.equal(stream.closed, true);
  assert.equal(statuses.at(-1), "Finished");
  unsubscribe();
});
