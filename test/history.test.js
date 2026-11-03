const test = require("node:test");
const assert = require("node:assert/strict");
const history = require("../src/history.js");

const states = [
  { key: "100-A", notes: "Invariant: keep the smallest value in the window.", solved: true, attempts: 2, updatedAt: new Date(2024, 0, 2, 10).getTime(), problem: { key: "100-A", label: "100A", title: "Window minimum", rating: "800", tags: ["two pointers", "implementation"] } },
  { key: "101-B", notes: "Mistake: forgot to reset the counter after a gap.", solved: false, attempts: 3, updatedAt: new Date(2024, 0, 1, 10).getTime(), problem: { key: "101-B", label: "101B", title: "Counter gaps", rating: "1000", tags: ["implementation"] } },
  { key: "102-C", notes: "", solved: false, attempts: 1, updatedAt: new Date(2023, 11, 28, 10).getTime(), problem: { key: "102-C", label: "102C", title: "No note", rating: "1200", tags: ["graphs"] } }
];

test("indexes notes and searches title, tags, and note content", () => {
  const notes = history.indexNotes(states);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].label, "100A");
  assert.equal(history.searchNotes(notes, "window invariant").length, 1);
  assert.equal(history.searchNotes(notes, "implementation").length, 2);
  assert.equal(history.searchNotes(notes, "missing").length, 0);
});

test("aggregates saved state and local activity history", () => {
  const events = { events: [
    { problemKey: "100-A", at: new Date(2024, 0, 2, 11).getTime(), attempts: 2, solved: true },
    { problemKey: "101-B", at: new Date(2024, 0, 1, 11).getTime(), attempts: 3, solved: false }
  ] };
  const metrics = history.aggregateHistory(states, events, new Date(2024, 0, 3, 12).getTime());
  assert.equal(metrics.totalProblems, 3);
  assert.equal(metrics.solvedProblems, 1);
  assert.equal(metrics.totalAttempts, 6);
  assert.equal(metrics.notesWritten, 2);
  assert.equal(metrics.currentStreak, 2);
  assert.deepEqual(metrics.topicStats[0], { tag: "implementation", practiced: 2, solved: 1, attempts: 5, notes: 2, score: 50 });
});

test("coalesces one history event per problem and day", () => {
  const at = new Date(2024, 0, 2, 10).getTime();
  const first = history.appendHistory(null, { problemKey: "100-A", at, attempts: 1, solved: false });
  const second = history.appendHistory(first, { problemKey: "100-A", at: at + 60 * 60 * 1000, attempts: 2, solved: true });
  assert.equal(second.events.length, 1);
  assert.deepEqual(second.events[0], { problemKey: "100-A", at: at + 60 * 60 * 1000, attempts: 2, solved: true });
});
