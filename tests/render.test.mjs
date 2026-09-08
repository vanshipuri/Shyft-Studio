import assert from "node:assert/strict";
import test from "node:test";

// Run against `npm start`. These checks never modify the database.
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const proxyHeaders = {
  Host: "shyft-preview.example.test",
  "X-Forwarded-Host": "shyft-preview.example.test",
  "X-Forwarded-Proto": "https",
};

function post(path, fields = {}) {
  return fetch(new URL(path, baseURL), {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: proxyHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
}

function assertRedirect(response, path) {
  assert.equal(response.status, 303, "form POST should be followed by a GET");
  assert.equal(response.headers.get("location"), path, "redirect must stay on the public origin");
}

test("Render health check serves the login page behind a proxy", async () => {
  const response = await fetch(new URL("/login", baseURL), {
    headers: proxyHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Shyft Studio/);
});

test("all seeded demo accounts can log in and read the dashboard", async () => {
  for (const name of ["samyak", "abhishek", "siddhant"]) {
    const response = await post("/api/auth/login", {
      email: `${name}@shyft.studio`,
      password: "password123",
    });
    assertRedirect(response, "/dashboard");
    const session = response.headers.get("set-cookie");
    assert.ok(session?.startsWith("shyft_session="), "login should set a session cookie");
    assert.match(session, /HttpOnly/i);

    const dashboard = await fetch(new URL("/dashboard", baseURL), {
      headers: { ...proxyHeaders, Cookie: session.split(";")[0] },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(dashboard.status, 200, `${name} should have dashboard access`);
    assert.match(await dashboard.text(), /Welcome back/);
  }
});

test("invalid credentials are rejected", async () => {
  const response = await post("/api/auth/login", {
    email: "samyak@shyft.studio",
    password: "wrong-password",
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("missing credentials redirect to the public login page", async () => {
  assertRedirect(await post("/api/auth/login"), "/login");
});

test("incomplete job forms redirect without changing data or leaking the internal host", async () => {
  assertRedirect(await post("/api/jobs/update-stage", { jobId: "1" }), "/jobs/1");
  assertRedirect(await post("/api/notes/add", { jobId: "1", userId: "1" }), "/jobs/1");
});

test("logout clears the cookie and redirects to the public login page", async () => {
  const response = await post("/api/auth/logout");
  assertRedirect(response, "/login");
  assert.match(response.headers.get("set-cookie") || "", /shyft_session=;/);
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/i);
});
