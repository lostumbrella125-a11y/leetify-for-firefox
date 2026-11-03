(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LeetifyTestcases = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalizeTestcase(test, index) {
    const value = test || {};
    return {
      id: String(value.id || `custom-${index + 1}`),
      label: String(value.label || `Custom ${index + 1}`),
      input: String(value.input == null ? "" : value.input),
      output: String(value.output == null ? "" : value.output)
    };
  }

  function normalizeTests(tests) {
    const list = Array.isArray(tests) ? tests : [];
    return (list.length ? list : [{}]).map(normalizeTestcase);
  }

  function uniqueId(tests, base) {
    const ids = new Set(tests.map((test) => test.id));
    let id = base || "custom";
    let suffix = 2;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    return id;
  }

  function addTestcase(tests, testcase) {
    const current = normalizeTests(tests);
    const next = normalizeTestcase(testcase, current.length);
    next.id = uniqueId(current, next.id);
    return [...current, next];
  }

  function renameTestcase(tests, index, label) {
    const current = normalizeTests(tests);
    const nextLabel = String(label == null ? "" : label).trim();
    if (!current[index] || !nextLabel) return current;
    return current.map((test, testIndex) => testIndex === index ? { ...test, label: nextLabel } : test);
  }

  function duplicateTestcase(tests, index) {
    const current = normalizeTests(tests);
    if (!current[index]) return current;
    const original = current[index];
    const copy = {
      ...original,
      id: uniqueId(current, `${original.id}-copy`),
      label: `${original.label} copy`
    };
    return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
  }

  function deleteTestcase(tests, index) {
    const current = normalizeTests(tests);
    if (current.length <= 1 || !current[index]) return current;
    return current.filter((test, testIndex) => testIndex !== index);
  }

  function moveTestcase(tests, index, direction) {
    const current = normalizeTests(tests);
    const delta = direction === "left" ? -1 : direction === "right" ? 1 : Number(direction);
    const target = index + delta;
    if (!current[index] || !Number.isInteger(delta) || target < 0 || target >= current.length) return current;
    const next = current.slice();
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  return { normalizeTestcase, normalizeTests, addTestcase, renameTestcase, duplicateTestcase, deleteTestcase, moveTestcase };
});
