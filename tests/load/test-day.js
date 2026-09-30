/** S9-01: real start form, saves, synchronized submit burst and result reads.
 * Existing sessions model a class already logged in; LOGIN=1 measures login
 * separately (shared-school-IP rate limits still apply on Vercel).
 */

import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";
import http from "k6/http";
import { Counter } from "k6/metrics";

const completed = new Counter("completed_students");

const manifest = JSON.parse(open("../../tmp/load-fixture.json"));
const users = new SharedArray("users", () => manifest.users);
const base = __ENV.BASE_URL;
if (!base || (__ENV.TARGET !== "local" && __ENV.TARGET !== "staging"))
  throw new Error(
    "Set BASE_URL and TARGET=local|staging; never run against production.",
  );
if (
  __ENV.TARGET === "local" &&
  !/^http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?$/.test(
    base,
  )
)
  throw new Error("Local target must be loopback.");
const vus = Number(__ENV.VUS || 100);
const duration = Number(__ENV.TEST_SECONDS || 300);
const ramp = Number(__ENV.RAMP_SECONDS || 60);
if (
  !Number.isInteger(vus) ||
  vus < 1 ||
  vus > users.length ||
  !Number.isInteger(duration) ||
  !Number.isInteger(ramp) ||
  ramp < 0 ||
  duration < ramp + 15 ||
  duration > 300
)
  throw new Error("Invalid load parameters.");
export const options = {
  scenarios: {
    testDay: {
      executor: "per-vu-iterations",
      vus,
      iterations: 1,
      maxDuration: "8m",
    },
  },
  thresholds: {
    completed_students: [`count==${vus}`],
    http_req_failed: ["rate<0.001"],
    checks: ["rate==1"],
    ...Object.fromEntries(
      ["start", "runner", "save", "submit", "result"].map((endpoint) => [
        `http_req_duration{endpoint:${endpoint}}`,
        ["p(95)<800"],
      ]),
    ),
    "http_req_duration{endpoint:start}": ["p(95)<300"],
    "http_req_duration{endpoint:submit}": ["p(95)<500"],
  },
};
export function setup() {
  return { start: Date.now() };
}
// Next's progressive Server Action protocol requires multipart/form-data.
function postForm(page, form, overrides, requestParams) {
  const inputs = form.find("input");
  const fields = { ...overrides };
  inputs.each((i) => {
    const input = inputs.eq(i);
    const name = input.attr("name");
    if (name && !(name in fields)) fields[name] = input.attr("value") || "";
  });
  const boundary = `k6-${__VU}-${Date.now()}`;
  const parts = Object.entries(fields)
    .map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    )
    .join("");
  const body = `${parts}--${boundary}--\r\n`;
  return http.post(page.url, body, {
    ...requestParams,
    headers: {
      ...requestParams.headers,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
  });
}
export default function (data) {
  const user = users[__VU - 1];
  const bypass = __ENV.VERCEL_AUTOMATION_BYPASS_SECRET;
  const headers = {
    Origin: base,
    ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
  };
  if (__ENV.TARGET === "local") {
    // The production proxy renews Secure cookies; local HTTP cannot return
    // them through k6's jar. Explicit transport here keeps app policy intact.
    headers.Cookie = `ovl_session=${user.token}`;
    headers["x-forwarded-for"] =
      `10.99.${Math.floor(__VU / 250)}.${(__VU % 250) + 1}`;
  }
  const params = (endpoint) => ({ headers, redirects: 0, tags: { endpoint } });
  sleep(
    Math.max(
      0,
      (data.start + ((__VU - 1) / vus) * ramp * 1000 - Date.now()) / 1000,
    ),
  );
  http.cookieJar().set(base, "ovl_session", user.token);
  if (__ENV.LOGIN === "1") {
    const page = http.get(`${base}/login`, params("login-page"));
    const login = postForm(
      page,
      page.html().find("form").first(),
      { identifier: user.phone, password: manifest.password },
      params("login"),
    );
    if (!check(login, { "login succeeds": (r) => r.status === 303 }))
      fail("Login failed");
    const token = login.cookies.ovl_session?.[0]?.value;
    if (!token) fail("Login did not create a session");
    http.cookieJar().set(base, "ovl_session", token);
    if (__ENV.TARGET === "local") headers.Cookie = `ovl_session=${token}`;
  }
  const overview = http.get(
    `${base}/lessons/${manifest.lessonId}`,
    params("overview"),
  );
  if (!check(overview, { "overview loads": (r) => r.status === 200 }))
    fail("Overview failed");
  const startForm = overview
    .html()
    .find('input[name="lessonId"]')
    .first()
    .parent();
  if (!startForm.size()) fail("Use fresh fixtures: start form is missing");
  const start = postForm(
    overview,
    startForm,
    { lessonId: String(manifest.lessonId) },
    params("start"),
  );
  const path = start.headers.Location;
  if (
    !check(start, {
      "start redirects to attempt": (r) =>
        r.status === 303 && /\/attempts\/[0-9a-f-]{36}$/.test(path || ""),
    })
  )
    fail(`Start failed: status=${start.status}, destination=${path || "none"}`);
  const attemptId = path.split("/").pop();
  const runner = http.get(`${base}${path}`, params("runner"));
  if (
    !check(runner, {
      "runner loads without keys": (r) =>
        r.status === 200 && !/\\?"(?:answer|explanation)\\?"\s*:/.test(r.body),
    })
  )
    fail("Runner failed");
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };
  if (__ENV.TARGET === "local") {
    jsonHeaders.Origin = base.replace("host.docker.internal", "localhost");
  }
  const jsonParams = (endpoint) => ({
    ...params(endpoint),
    headers: jsonHeaders,
  });
  const answers = Array.from({ length: 28 }, (_, i) => "ABCD"[i % 4]);
  const submitAt = data.start + duration * 1000 + ((__VU - 1) / vus) * 10_000;
  while (Date.now() < submitAt - 5000) {
    const saved = http.post(
      `${base}/api/attempts/${attemptId}/save`,
      JSON.stringify({ answers, flagged: [] }),
      jsonParams("save"),
    );
    if (
      !check(saved, {
        "save succeeds": (r) => r.status === 200 && r.json("ok") === true,
      })
    )
      fail(`Save failed: status=${saved.status}, code=${saved.json("code")}`);
    sleep(5);
  }
  sleep(Math.max(0, (submitAt - Date.now()) / 1000));
  const submit = http.post(
    `${base}/api/attempts/${attemptId}/submit`,
    JSON.stringify({
      answers,
      flagged: [],
      clientSubmitId: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (c) => {
          const n = Math.floor(Math.random() * 16);
          return (c === "x" ? n : (n & 3) | 8).toString(16);
        },
      ),
    }),
    jsonParams("submit"),
  );
  if (
    !check(submit, {
      "score is present and exact": (r) =>
        r.status === 200 &&
        r.json("data.score") === 7 &&
        r.json("data.score10") === 2.5,
    })
  ) {
    // Log only codes and numeric scores, never credentials or response bodies.
    let detail = {};
    try {
      const body = submit.json();
      detail = {
        code: body.code,
        score: body.data?.score,
        score10: body.data?.score10,
      };
    } catch {
      /* A dropped connection has no JSON body. */
    }
    console.error(
      JSON.stringify({ endpoint: "submit", status: submit.status, ...detail }),
    );
    fail("Submit failed");
  }
  const result = http.get(
    `${base}/attempts/${attemptId}/result`,
    params("result"),
  );
  check(result, { "result loads": (r) => r.status === 200 });
  if (result.status === 200) completed.add(1);
}
