const test = require("node:test");
const assert = require("node:assert/strict");
const testcases = require("../src/testcases.js");

function sampleTests() {
  return [
    { id: "a", label: "Sample 1", input: "1", output: "one" },
    { id: "b", label: "Sample 2", input: "2", output: "two" }
  ];
}

test("renames and duplicates a testcase without changing its data", () => {
  const renamed = testcases.renameTestcase(sampleTests(), 0, "Edge case");
  const duplicated = testcases.duplicateTestcase(renamed, 0);

  assert.equal(duplicated[0].label, "Edge case");
  assert.deepEqual(duplicated[1], { id: "a-copy", label: "Edge case copy", input: "1", output: "one" });
  assert.equal(duplicated[2].id, "b");
});

test("deletes and reorders testcases while preserving a final testcase", () => {
  const moved = testcases.moveTestcase(sampleTests(), 1, "left");
  const deleted = testcases.deleteTestcase(moved, 0);
  const last = testcases.deleteTestcase(deleted, 0);

  assert.deepEqual(moved.map((item) => item.id), ["b", "a"]);
  assert.deepEqual(deleted.map((item) => item.id), ["a"]);
  assert.deepEqual(last.map((item) => item.id), ["a"]);
});
