const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");

test("parses supported Codeforces problem URL shapes", () => {
  assert.deepEqual(core.parseProblemUrl("/problemset/problem/4/A"), { area: "problemset", contestId: "4", index: "A", key: "4-A" });
  assert.deepEqual(core.parseProblemUrl("/contest/1919/problem/A"), { area: "contest", contestId: "1919", index: "A", key: "1919-A" });
  assert.deepEqual(core.parseProblemUrl("/group/abc/contest/1919/problem/A"), { area: "group", groupId: "abc", contestId: "1919", index: "A", key: "1919-A" });
  assert.equal(core.parseProblemUrl("/problemset"), null);
});

test("normalizes whitespace when comparing testcase output", () => {
  assert.equal(core.compareOutputs("YES\n", "  YES  "), true);
  assert.equal(core.compareOutputs("YES", "NO"), false);
});

test("runs JavaScript solve functions against input", () => {
  const result = core.executeJavaScript("function solve(input) { return input.trim().split('').reverse().join(''); }", "abc\n");
  assert.deepEqual(result, { ok: true, output: "cba" });
});

test("returns a useful error for missing solve function", () => {
  const result = core.executeJavaScript("const answer = 42;", "");
  assert.equal(result.ok, false);
  assert.match(result.error, /solve\(input\)/);
});

test("generates the Codeforces submit route", () => {
  assert.equal(core.submitPath({ area: "problemset", contestId: "4", index: "A" }), "/problemset/submit");
  assert.equal(core.submitPath({ area: "contest", contestId: "1919", index: "A" }), "/contest/1919/submit");
  assert.equal(core.submitPath({ area: "group", groupId: "abc", contestId: "1919", index: "A" }), "/group/abc/contest/1919/submit");
});


test("parses submission and status route shapes", () => {
  assert.deepEqual(core.parseSubmissionRoute("/problemset/submit?contestId=4"), { area: "problemset", action: "submit", contestId: undefined, index: undefined });
  assert.deepEqual(core.parseSubmissionRoute("/contest/1919/status/problem/A"), { area: "contest", contestId: "1919", action: "status", index: "A" });
  assert.deepEqual(core.parseSubmissionRoute("/contest/1919/status/A"), { area: "contest", contestId: "1919", action: "status", index: "A" });
  assert.deepEqual(core.parseSubmissionRoute("/problemset/status/4/A"), { area: "problemset", action: "status", contestId: "4", index: "A" });
  assert.deepEqual(core.parseSubmissionRoute("/group/abc/contest/1919/submit"), { area: "group", groupId: "abc", contestId: "1919", action: "submit", index: undefined });
  assert.equal(core.parseSubmissionRoute("/contest/1919/problem/A"), null);
});

test("finds Codeforces submission form fields and matching options", () => {
  const source = { id: "sourceCode" };
  const language = { name: "programTypeId", options: [
    { value: "1", textContent: "GNU C++14" },
    { value: "2", textContent: "GNU C++17 (64)" }
  ] };
  const problem = { name: "submittedProblemIndex", options: [
    { value: "A", textContent: "A. Watermelon" },
    { value: "B", textContent: "B. Another problem" }
  ] };
  const problemCode = { name: "submittedProblemCode" };
  const form = { id: "submitForm" };
  const nodes = {
    "textarea[name='sourceCode']": source,
    "select[name='programTypeId']": language,
    "select[name='submittedProblemIndex']": problem,
    "input[name='submittedProblemCode']": problemCode,
    "form#submitForm": form
  };
  const doc = { querySelector: (selector) => nodes[selector] || null };
  const fields = core.parseSubmissionForm(doc);
  assert.equal(fields.source, source);
  assert.equal(fields.language, language);
  assert.equal(fields.problem, problem);
  assert.equal(fields.problemCode, problemCode);
  assert.equal(fields.form, form);
  assert.equal(core.findLanguageOption(language.options, "cpp").value, "2");
  assert.equal(core.findProblemOption(problem.options, { contestId: "4", index: "B" }).value, "B");
});

test("normalizes observable verdicts and derives problem stats", () => {
  assert.deepEqual(core.normalizeVerdict("Accepted"), { status: "accepted", verdict: "Accepted" });
  assert.equal(core.normalizeVerdict("TESTING").status, "pending");
  assert.equal(core.normalizeVerdict("OK").status, "accepted");
  assert.equal(core.normalizeVerdict("Compilation error").status, "failed");
  assert.equal(core.normalizeVerdict("Wrong answer").status, "failed");

  const problemLink = { href: "/contest/4/problem/A", textContent: "A" };
  const authorLink = { href: "/profile/alice", textContent: "alice" };
  const verdictNode = { textContent: "Accepted" };
  const row = {
    textContent: "1 alice A Accepted",
    querySelectorAll: (selector) => selector === "td" ? [{ textContent: "1" }] : [],
    querySelector: (selector) => {
      if (selector.includes("/problem/")) return problemLink;
      if (selector.includes("/profile/")) return authorLink;
      if (selector === ".submissionVerdictWrapper") return verdictNode;
      return null;
    }
  };
  const currentUser = { href: "/profile/alice", textContent: "alice" };
  const doc = {
    querySelectorAll: (selector) => selector === "tr" ? [row] : [],
    querySelector: (selector) => selector === ".userbox a[href*='/profile/']" ? currentUser : null
  };
  const stats = core.getProblemStats(doc, { contestId: "4", index: "A", key: "4-A" });
  assert.equal(stats.attempts, 1);
  assert.equal(stats.solved, true);
  assert.equal(stats.latest.verdict, "Accepted");
});
