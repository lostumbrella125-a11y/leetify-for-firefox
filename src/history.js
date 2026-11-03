(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LeetifyHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STATE_PREFIX = "leetify:state:";
  const HISTORY_KEY = "leetify:history";
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const stateKey = (key) => `${STATE_PREFIX}${key}`;

  function normalizeProblem(problem, key) {
    const source = problem || {};
    return {
      key: source.key || key,
      label: String(source.label || key || "Problem"),
      title: String(source.title || source.label || key || "Problem"),
      rating: String(source.rating || "—"),
      tags: Array.isArray(source.tags) ? source.tags.map(String).filter(Boolean) : [],
      area: source.area || "problemset",
      groupId: source.groupId,
      contestId: source.contestId,
      index: source.index
    };
  }

  function normalizeStateRecord(key, value) {
    const source = value || {};
    return {
      ...source,
      key: key || (source.problem && source.problem.key),
      notes: String(source.notes || ""),
      solved: Boolean(source.solved),
      bookmarked: Boolean(source.bookmarked),
      attempts: Math.max(0, Math.floor(number(source.attempts, 0))),
      updatedAt: number(source.updatedAt, 0),
      problem: normalizeProblem(source.problem, key || (source.problem && source.problem.key))
    };
  }

  function normalizeHistory(value) {
    const events = value && Array.isArray(value.events) ? value.events : [];
    return {
      version: 1,
      events: events.filter((event) => event && event.problemKey && number(event.at, 0) > 0).map((event) => ({
        problemKey: String(event.problemKey),
        at: number(event.at, 0),
        attempts: Math.max(0, Math.floor(number(event.attempts, 0))),
        solved: Boolean(event.solved)
      }))
    };
  }

  function problemUrl(problem) {
    if (!problem || !problem.contestId || !problem.index) return "https://codeforces.com/problemset";
    if (problem.area === "group" && problem.groupId) return `https://codeforces.com/group/${encodeURIComponent(problem.groupId)}/contest/${encodeURIComponent(problem.contestId)}/problem/${encodeURIComponent(problem.index)}`;
    if (problem.area === "contest" || problem.area === "gym") return `https://codeforces.com/${problem.area}/${encodeURIComponent(problem.contestId)}/problem/${encodeURIComponent(problem.index)}`;
    return `https://codeforces.com/problemset/problem/${encodeURIComponent(problem.contestId)}/${encodeURIComponent(problem.index)}`;
  }

  function snippet(value, limit) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const max = limit || 220;
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }

  function indexNotes(states) {
    return (Array.isArray(states) ? states : []).map((value) => normalizeStateRecord(value.key, value))
      .filter((state) => state.key && state.notes.trim())
      .map((state) => ({
        key: state.key,
        title: state.problem.title,
        label: state.problem.label,
        rating: state.problem.rating,
        tags: state.problem.tags,
        notes: state.notes,
        snippet: snippet(state.notes),
        solved: state.solved,
        attempts: state.attempts,
        updatedAt: state.updatedAt,
        url: problemUrl(state.problem)
      }))
      .sort((left, right) => right.updatedAt - left.updatedAt || left.title.localeCompare(right.title));
  }

  function searchNotes(notes, query) {
    const terms = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return Array.isArray(notes) ? notes.slice() : [];
    return (Array.isArray(notes) ? notes : []).filter((note) => {
      const text = [note.title, note.label, note.rating, ...(note.tags || []), note.notes].join(" ").toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }

  function dayKey(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateAtMidnight(day) {
    const parts = String(day).split("-").map(Number);
    return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
  }

  function topicStats(states) {
    const topics = new Map();
    (Array.isArray(states) ? states : []).forEach((state) => {
      (state.problem && Array.isArray(state.problem.tags) ? state.problem.tags : []).forEach((tag) => {
        const current = topics.get(tag) || { tag, practiced: 0, solved: 0, attempts: 0, notes: 0 };
        current.practiced += 1;
        current.solved += state.solved ? 1 : 0;
        current.attempts += state.attempts || 0;
        current.notes += state.notes.trim() ? 1 : 0;
        topics.set(tag, current);
      });
    });
    return Array.from(topics.values()).map((topic) => ({
      ...topic,
      score: topic.practiced ? Math.round(topic.solved / topic.practiced * 100) : 0
    })).sort((left, right) => right.practiced - left.practiced || left.tag.localeCompare(right.tag));
  }

  function aggregateHistory(states, history, now) {
    const normalized = (Array.isArray(states) ? states : []).map((state) => normalizeStateRecord(state.key, state)).filter((state) => state.key);
    const savedHistory = normalizeHistory(history);
    const dates = new Set(savedHistory.events.map((event) => dayKey(event.at)).filter(Boolean));
    normalized.forEach((state) => { if (state.updatedAt) dates.add(dayKey(state.updatedAt)); });
    const today = dayKey(now || Date.now());
    let cursor = dateAtMidnight(today);
    if (cursor && !dates.has(today)) cursor.setDate(cursor.getDate() - 1);
    let currentStreak = 0;
    while (cursor && dates.has(dayKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      totalProblems: normalized.length,
      solvedProblems: normalized.filter((state) => state.solved).length,
      totalAttempts: normalized.reduce((total, state) => total + state.attempts, 0),
      notesWritten: normalized.filter((state) => state.notes.trim()).length,
      bookmarkedProblems: normalized.filter((state) => state.bookmarked).length,
      activeDays: dates.size,
      currentStreak,
      lastActiveAt: Math.max(0, ...savedHistory.events.map((event) => event.at), ...normalized.map((state) => state.updatedAt)),
      topicStats: topicStats(normalized)
    };
  }

  function buildTrainingPlan(states) {
    const normalized = (Array.isArray(states) ? states : []).map((state) => normalizeStateRecord(state.key, state)).filter((state) => state.key);
    const item = (state) => ({ key: state.key, label: state.problem.label, title: state.problem.title, tags: state.problem.tags, solved: state.solved, attempts: state.attempts, notes: state.notes, url: problemUrl(state.problem), updatedAt: state.updatedAt });
    return {
      practice: normalized.filter((state) => !state.solved && (state.attempts > 0 || state.notes.trim())).sort((a, b) => b.updatedAt - a.updatedAt).map(item),
      revision: normalized.filter((state) => state.solved).sort((a, b) => b.updatedAt - a.updatedAt).map(item),
      topics: topicStats(normalized).slice(0, 5)
    };
  }

  function appendHistory(history, event) {
    const next = normalizeHistory(history);
    if (!event || !event.problemKey) return next;
    const at = number(event.at, Date.now());
    const existing = next.events.find((item) => item.problemKey === String(event.problemKey) && dayKey(item.at) === dayKey(at));
    const record = { problemKey: String(event.problemKey), at, attempts: Math.max(0, Math.floor(number(event.attempts, 0))), solved: Boolean(event.solved) };
    if (existing) Object.assign(existing, record);
    else next.events.push(record);
    next.events.sort((left, right) => left.at - right.at);
    if (next.events.length > 3650) next.events = next.events.slice(-3650);
    return next;
  }

  function createLocalStore(storageArea) {
    const get = async (key) => {
      if (!storageArea || typeof storageArea.get !== "function") return undefined;
      try { const result = await storageArea.get(key); return key === null ? result : result && result[key]; } catch (error) { return undefined; }
    };
    const set = async (key, value) => {
      if (!storageArea || typeof storageArea.set !== "function") return false;
      try { await storageArea.set({ [key]: value }); return true; } catch (error) { return false; }
    };
    return {
      get,
      set,
      async listProblemStates() {
        const all = await get(null);
        return Object.entries(all || {}).filter(([key, value]) => key.startsWith(STATE_PREFIX) && value && typeof value === "object").map(([key, value]) => normalizeStateRecord(key.slice(STATE_PREFIX.length), value));
      },
      async getHistory() { return normalizeHistory(await get(HISTORY_KEY)); },
      async saveProblemState(key, value, problem, at) {
        const timestamp = number(at, Date.now());
        const record = normalizeStateRecord(key, { ...value, problem: normalizeProblem(problem, key), updatedAt: timestamp });
        await set(stateKey(key), record);
        await set(HISTORY_KEY, appendHistory(await get(HISTORY_KEY), { problemKey: key, at: timestamp, attempts: record.attempts, solved: record.solved }));
        return record;
      },
      async getDashboard() {
        const states = await this.listProblemStates();
        const savedHistory = await this.getHistory();
        return { states, history: savedHistory, notes: indexNotes(states), metrics: aggregateHistory(states, savedHistory), training: buildTrainingPlan(states) };
      }
    };
  }

  return { STATE_PREFIX, HISTORY_KEY, stateKey, normalizeStateRecord, indexNotes, searchNotes, aggregateHistory, buildTrainingPlan, appendHistory, problemUrl, createLocalStore };
});
