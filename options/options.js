(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const history = typeof globalThis !== "undefined" ? globalThis.LeetifyHistory : null;
  if (!api || !history) return;
  const store = history.createLocalStore(api.storage && api.storage.local);
  let dashboard = { notes: [], metrics: {}, training: { topics: [], practice: [], revision: [] } };
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const formatDate = (value) => { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No activity date"; };
  function renderMetrics(metrics) {
    const values = { streak: `${metrics.currentStreak || 0} day${metrics.currentStreak === 1 ? "" : "s"}`, solved: metrics.solvedProblems || 0, problems: metrics.totalProblems || 0, attempts: metrics.totalAttempts || 0, notes: metrics.notesWritten || 0 };
    Object.entries(values).forEach(([name, value]) => { const node = document.querySelector(`[data-metric="${name}"]`); if (node) node.textContent = String(value); });
  }
  function renderNotes(query) {
    const notes = history.searchNotes(dashboard.notes, query);
    const list = document.querySelector("[data-note-list]");
    const count = document.querySelector("[data-note-count]");
    if (count) count.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"} matching this view`;
    if (!list) return;
    if (!notes.length) { list.innerHTML = `<div class="empty">${query ? "No notes match that search." : "Notes you write on problem pages will appear here."}</div>`; return; }
    list.innerHTML = notes.map((note) => `<a class="note-row" href="${escapeHtml(note.url)}" target="_blank" rel="noopener"><div class="note-meta"><span>${escapeHtml(note.label)}</span><span>·</span><span>${escapeHtml(formatDate(note.updatedAt))}</span>${note.solved ? '<span class="status">· Solved</span>' : ""}${(note.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div><div class="note-title">${escapeHtml(note.title)}</div><div class="note-snippet">${escapeHtml(note.snippet)}</div></a>`).join("");
  }
  function renderTopics(topics) {
    const list = document.querySelector("[data-topic-list]");
    if (!list) return;
    if (!topics.length) { list.innerHTML = '<div class="empty">Topic activity will appear after you open tagged problems.</div>'; return; }
    list.innerHTML = topics.map((topic) => `<div class="topic-row"><span class="topic-name">${escapeHtml(topic.tag)}</span><span class="topic-count">${topic.solved}/${topic.practiced} solved</span><div class="topic-bar"><span style="width:${topic.score}%"></span></div></div>`).join("");
  }
  function queueMarkup(items, emptyText) {
    if (!items.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return items.slice(0, 6).map((item) => `<a class="queue-row" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="queue-meta"><span>${escapeHtml(item.label)}</span><span>·</span><span>${item.attempts} attempt${item.attempts === 1 ? "" : "s"}</span></div><div class="queue-title">${escapeHtml(item.title)}</div><div class="note-meta">${(item.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></a>`).join("");
  }
  function renderTraining(training) {
    const practice = document.querySelector("[data-practice-list]");
    const revision = document.querySelector("[data-revision-list]");
    if (practice) practice.innerHTML = queueMarkup(training.practice, "No unfinished practice items yet.");
    if (revision) revision.innerHTML = queueMarkup(training.revision, "Solved problems will appear here for revision.");
  }
  async function refresh() {
    dashboard = await store.getDashboard();
    renderMetrics(dashboard.metrics);
    renderNotes(document.querySelector("[data-note-search]")?.value || "");
    renderTopics(dashboard.metrics.topicStats || []);
    renderTraining(dashboard.training);
  }
  document.querySelector("[data-note-search]")?.addEventListener("input", (event) => renderNotes(event.target.value));
  if (api.storage && api.storage.onChanged) api.storage.onChanged.addListener(() => refresh());
  refresh();
})();
