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
