(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const core = window.LeetifyCore;
  const metadata = core && core.parseProblemMetadata(document, window.location);

  if (!core) return;

  const stateKey = (key) => `leetify:state:${key}`;
  const pendingKey = "leetify:pending-submission";
  let host;
  let shadow;
  let state;
  let saveTimer;
  let activeTest = 0;

  const storageGet = async (key) => {
    try {
      const value = await api.storage.local.get(key);
      return value[key];
    } catch (error) {
      return undefined;
    }
  };

  const storageSet = async (key, value) => {
    try {
      await api.storage.local.set({ [key]: value });
    } catch (error) {
      // Private browsing or a disabled storage area should not break editing.
    }
  };

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function styleSheet() {
    return `
      :host { color: #dbe7f6; }
      .app { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; color: #dbe7f6; background: #0b1220; font-size: 13px; line-height: 1.4; }
      .topbar { height: 58px; flex: 0 0 58px; display: flex; align-items: center; gap: 16px; padding: 0 20px; border-bottom: 1px solid #23324a; background: #101b2d; }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 230px; }
      .brand-mark { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 8px; color: #07111e; background: #72e6b4; font-size: 15px; font-weight: 900; }
      .brand-title { color: #f4f8ff; font-size: 15px; font-weight: 750; letter-spacing: .01em; }
      .brand-subtitle { margin-top: 1px; color: #8192ad; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; }
      .problem-heading { display: flex; align-items: center; min-width: 0; gap: 10px; flex: 1; }
      .problem-id { padding: 4px 8px; border: 1px solid #315176; border-radius: 5px; color: #a6c8fa; background: #16263d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 700; }
      .problem-title { overflow: hidden; color: #f4f8ff; font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .top-actions { display: flex; align-items: center; gap: 8px; }
      button, select { border: 1px solid #334b69; border-radius: 6px; color: #dce9f9; background: #17263b; cursor: pointer; }
      button { padding: 7px 11px; font-size: 12px; font-weight: 650; transition: border-color .15s, background .15s, transform .15s; }
      button:hover { border-color: #72e6b4; background: #1d3550; }
      button:active { transform: translateY(1px); }
      button.primary { border-color: #72e6b4; color: #07111e; background: #72e6b4; }
      button.primary:hover { background: #91f2c5; }
      button.ghost { border-color: transparent; background: transparent; color: #94a8c5; }
      button.danger:hover { border-color: #f47d95; color: #f47d95; }
      .layout { min-height: 0; display: grid; grid-template-columns: 248px minmax(0, 1fr); flex: 1; }
      .sidebar { min-height: 0; padding: 16px 14px; overflow-y: auto; border-right: 1px solid #23324a; background: #0e192a; }
      .section-label { margin: 16px 8px 8px; color: #7488a5; font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
      .section-label:first-child { margin-top: 2px; }
      .stat-card { padding: 12px; border: 1px solid #233a56; border-radius: 8px; background: #122237; }
      .rating { display: flex; align-items: baseline; gap: 7px; }
      .rating-value { color: #f5c76d; font-size: 24px; font-weight: 800; }
      .rating-label { color: #8498b6; font-size: 11px; }
      .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .tag { padding: 4px 7px; border: 1px solid #29415f; border-radius: 4px; color: #9bb7d8; background: #142840; font-size: 11px; }
      .nav-list { display: grid; gap: 3px; }
      .nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 6px; color: #8da2c0; }
      .nav-item.active { color: #dff9ed; background: #18354a; }
      .nav-icon { width: 16px; color: #72e6b4; text-align: center; font-weight: 800; }
      .sidebar-foot { margin-top: 26px; padding: 10px; border-radius: 7px; color: #7f92ad; background: #111f33; font-size: 11px; line-height: 1.5; }
      .workspace { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #0a1321; }
      .workspace-toolbar { height: 46px; flex: 0 0 46px; display: flex; align-items: center; justify-content: space-between; padding: 0 13px 0 18px; border-bottom: 1px solid #23324a; background: #0d192a; }
      .tabs { display: flex; align-items: stretch; height: 100%; gap: 6px; }
      .tab { display: flex; align-items: center; padding: 0 10px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: #8194b1; background: transparent; }
      .tab.active { border-bottom-color: #72e6b4; color: #eaf8f2; }
      .toolbar-actions { display: flex; align-items: center; gap: 8px; }
      .save-state { color: #7187a4; font-size: 11px; }
      .split { --split: 46%; min-height: 0; display: grid; grid-template-columns: minmax(260px, var(--split)) 7px minmax(350px, 1fr); flex: 1; }
      .statement-pane, .editor-pane { min-width: 0; min-height: 0; overflow: hidden; }
      .statement-pane { overflow-y: auto; padding: 26px clamp(20px, 3vw, 44px) 36px; background: #f6f8fb; color: #1d2a3b; }
      .statement-pane .problem-statement { max-width: 760px; margin: 0 auto; font-family: Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.65; }
      .statement-pane .header { padding-bottom: 18px; margin-bottom: 20px; border-bottom: 1px solid #dce3ed; }
      .statement-pane .header .title { margin-bottom: 12px; color: #15263e; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 26px; font-weight: 800; line-height: 1.2; }
      .statement-pane .time-limit, .statement-pane .memory-limit, .statement-pane .input-file, .statement-pane .output-file { display: inline-block; margin: 0 18px 0 0; color: #44566e; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 12px; }
      .statement-pane .property-title, .statement-pane .section-title { color: #647892; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .statement-pane .section-title { margin-top: 22px; margin-bottom: 5px; }
      .statement-pane pre { padding: 12px 14px; overflow-x: auto; border: 1px solid #dbe3ec; border-radius: 6px; color: #23354d; background: #edf2f7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.5; }
      .statement-pane .sample-test { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .statement-pane .sample-test .title { margin-top: 8px; color: #53677f; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 750; }
      .drag-handle { position: relative; z-index: 2; cursor: col-resize; background: #1a2b42; }
      .drag-handle:hover, .drag-handle.dragging { background: #72e6b4; }
      .editor-pane { display: flex; flex-direction: column; background: #0b1525; }
      .editor-header { display: flex; align-items: center; justify-content: space-between; min-height: 52px; padding: 10px 14px; border-bottom: 1px solid #20334d; }
      .editor-title { color: #edf5ff; font-size: 12px; font-weight: 700; }
      .editor-subtitle { margin-top: 2px; color: #7086a4; font-size: 10px; }
      select { min-width: 126px; padding: 7px 28px 7px 9px; outline: 0; font-size: 11px; }
      .code-wrap { min-height: 230px; display: grid; grid-template-columns: 42px 1fr; flex: 1; background: #0b1525; }
      .line-numbers { padding: 15px 9px 15px 0; overflow: hidden; color: #4c6381; background: #0a1321; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: right; user-select: none; }
      .code-input { width: 100%; height: 100%; min-height: 230px; resize: none; padding: 15px 16px; border: 0; outline: 0; color: #d7e7fa; background: transparent; caret-color: #72e6b4; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; tab-size: 4; white-space: pre; }
      .code-input::selection, .notes-input::selection { color: #f2fbff; background: #234e62; }
      .editor-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 13px; border-top: 1px solid #20334d; color: #7086a4; font-size: 10px; }
      .test-panel { min-height: 184px; max-height: 42%; display: flex; flex-direction: column; border-top: 1px solid #243852; background: #0e1a2b; }
      .test-header { display: flex; align-items: center; gap: 10px; padding: 9px 13px 0; }
      .test-title { color: #e3efff; font-size: 12px; font-weight: 750; }
      .test-tabs { display: flex; gap: 4px; overflow-x: auto; }
      .test-tab { padding: 4px 8px; border: 0; color: #8194b1; background: transparent; font-size: 11px; white-space: nowrap; }
      .test-tab.active { color: #72e6b4; }
      .test-body { min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 9px 13px 13px; flex: 1; }
      .test-field { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
      .test-field label { color: #6f85a1; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
      .test-input, .notes-input { width: 100%; min-height: 80px; resize: vertical; padding: 8px; border: 1px solid #263d59; border-radius: 5px; outline: 0; color: #cbdcf0; background: #0a1423; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .test-input:focus, .notes-input:focus, select:focus { border-color: #72e6b4; }
      .expected { color: #7188a5; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .result { min-height: 18px; color: #8499b5; font-size: 11px; }
      .result.ok { color: #72e6b4; }
      .result.fail { color: #ff9eae; }
      .notes-pane { min-height: 0; display: none; flex: 1; padding: 23px 28px; overflow: auto; }
      .notes-pane.active { display: block; }
      .notes-heading { margin: 0 0 5px; color: #f1f7ff; font-size: 17px; }
      .notes-help { margin: 0 0 16px; color: #7890af; font-size: 12px; }
      .notes-input { min-height: 340px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.6; }
      .toast { position: fixed; right: 18px; bottom: 18px; max-width: 330px; padding: 10px 13px; border: 1px solid #315b55; border-radius: 7px; color: #dff9ed; background: #14352f; box-shadow: 0 10px 30px #0007; font-size: 12px; }
      .hidden { display: none !important; }
      @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .sidebar { display: none; } .split { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 46%) 7px minmax(390px, 1fr); } .drag-handle { cursor: row-resize; } .statement-pane { min-height: 260px; } }
    `;
  }

  function defaultState() {
    const language = "cpp";
    const samples = core.parseSampleTests(metadata.statement);
    return {
      language,
      codeByLanguage: { [language]: core.starterCode(language, metadata.title) },
      notes: "",
      tests: samples.length ? samples : [{ id: "custom-1", label: "Custom 1", input: "", output: "" }],
      split: 46
    };
  }

  async function loadState() {
    const saved = await storageGet(stateKey(metadata.key));
    const fallback = defaultState();
    state = {
      ...fallback,
      ...(saved || {}),
      codeByLanguage: { ...fallback.codeByLanguage, ...((saved && saved.codeByLanguage) || {}) },
      tests: Array.isArray(saved && saved.tests) && saved.tests.length ? saved.tests : fallback.tests
    };
  }

  function currentCode() {
    return state.codeByLanguage[state.language] || "";
  }

  function queueSave() {
    updateSaveLabel("Saving…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await storageSet(stateKey(metadata.key), state);
      updateSaveLabel("Saved locally");
    }, 250);
  }

  function updateSaveLabel(text) {
    const label = shadow && shadow.querySelector("[data-save-state]");
    if (label) label.textContent = text;
  }

  function render() {
    host = document.createElement("div");
    host.id = "leetify-extension-host";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${styleSheet()}</style>${appTemplate()}`;
    const statementSlot = shadow.querySelector("[data-statement-slot]");
    if (statementSlot) statementSlot.appendChild(metadata.statement.cloneNode(true));
    document.documentElement.appendChild(host);
    document.documentElement.style.overflow = "hidden";
    bindEvents();
    refreshEditor();
    refreshTests();
  }

  function appTemplate() {
    const tags = metadata.tags.length ? metadata.tags : ["unclassified"];
    return `<div class="app" role="application" aria-label="Leetify Codeforces workspace">
      <header class="topbar">
        <div class="brand"><div class="brand-mark">L</div><div><div class="brand-title">Leetify</div><div class="brand-subtitle">Codeforces workspace</div></div></div>
        <div class="problem-heading"><span class="problem-id">${escapeHtml(metadata.label)}</span><span class="problem-title">${escapeHtml(metadata.title)}</span></div>
        <div class="top-actions"><span class="save-state" data-save-state>Saved locally</span><button class="ghost" data-action="close" title="Close workspace">Close</button></div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="section-label">Problem profile</div>
          <div class="stat-card"><div class="rating"><span class="rating-value">${escapeHtml(metadata.rating)}</span><span class="rating-label">difficulty</span></div><div class="tag-list" style="margin-top:10px">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div>
          <div class="section-label">Workspace</div>
          <nav class="nav-list"><button class="nav-item active" data-view="solve"><span class="nav-icon">⌘</span> Solve</button><button class="nav-item" data-view="notes"><span class="nav-icon">✎</span> Notes</button></nav>
          <div class="sidebar-foot">Your draft and notes are stored locally in Firefox and keyed to this problem.</div>
        </aside>
        <main class="workspace">
          <div class="workspace-toolbar"><div class="tabs"><button class="tab active" data-view="solve">Workspace</button><button class="tab" data-view="notes">Problem notes</button></div><div class="toolbar-actions"><button data-action="open-original">Open original</button><button class="primary" data-action="submit">Submit code</button></div></div>
          <section class="split" data-split><article class="statement-pane"><div data-statement-slot></div></article><div class="drag-handle" data-drag-handle title="Drag to resize"></div><section class="editor-pane"><div class="editor-header"><div><div class="editor-title">Solution editor</div><div class="editor-subtitle">Draft is saved automatically per problem</div></div><select data-language aria-label="Programming language">${Object.entries(core.LANGUAGES).map(([id, language]) => `<option value="${id}" ${state.language === id ? "selected" : ""}>${language.label}</option>`).join("")}</select></div><div class="code-wrap"><div class="line-numbers" data-line-numbers></div><textarea class="code-input" data-code spellcheck="false" aria-label="Solution code"></textarea></div><div class="editor-footer"><span>Tab inserts spaces · Ctrl/Cmd + Enter runs the active test</span><span data-code-stats></span></div><div class="test-panel"><div class="test-header"><span class="test-title">Test cases</span><div class="test-tabs" data-test-tabs></div><button class="ghost" data-action="add-test">+ Add</button><button class="primary" data-action="run-test">Run test</button></div><div class="test-body"><div class="test-field"><label for="test-input">Input</label><textarea id="test-input" class="test-input" data-test-input spellcheck="false"></textarea></div><div class="test-field"><label for="test-output">Expected output</label><textarea id="test-output" class="test-input" data-test-output spellcheck="false"></textarea><div class="result" data-result>JavaScript can run locally; other languages are ready to submit.</div></div></div></div></section></section>
          <section class="notes-pane"><h2 class="notes-heading">Notes for ${escapeHtml(metadata.label)} · ${escapeHtml(metadata.title)}</h2><p class="notes-help">Capture the key observation, an invariant, a failed approach, or the editorial insight you want to remember.</p><textarea class="notes-input" data-notes placeholder="Start writing your notes…"></textarea></section>
        </main>
      </div>
    </div>`;
  }

  function refreshEditor() {
    const code = shadow.querySelector("[data-code]");
    if (!code) return;
    code.value = currentCode();
    updateLineNumbers();
    updateCodeStats();
    shadow.querySelector("[data-notes]").value = state.notes || "";
    shadow.querySelector("[data-split]").style.setProperty("--split", `${state.split || 46}%`);
  }

  function updateLineNumbers() {
    const code = shadow.querySelector("[data-code]");
    const lineNumbers = shadow.querySelector("[data-line-numbers]");
    if (!code || !lineNumbers) return;
    lineNumbers.innerHTML = Array.from({ length: Math.max(1, code.value.split("\n").length) }, (_, i) => `${i + 1}`).join("<br>");
    lineNumbers.scrollTop = code.scrollTop;
  }

  function updateCodeStats() {
    const code = shadow.querySelector("[data-code]");
    const stats = shadow.querySelector("[data-code-stats]");
    if (!code || !stats) return;
    const lines = code.value.split("\n").length;
    stats.textContent = `${lines} lines · ${code.value.length} chars`;
  }

  function refreshTests() {
    const tabs = shadow.querySelector("[data-test-tabs]");
    const input = shadow.querySelector("[data-test-input]");
    const output = shadow.querySelector("[data-test-output]");
    if (!tabs || !input || !output) return;
    activeTest = Math.min(activeTest, state.tests.length - 1);
    tabs.innerHTML = state.tests.map((test, index) => `<button class="test-tab ${index === activeTest ? "active" : ""}" data-test-index="${index}">${escapeHtml(test.label)}</button>`).join("");
    const test = state.tests[activeTest];
    input.value = test.input || "";
    output.value = test.output || "";
    shadow.querySelector("[data-result]").textContent = state.language === "javascript" ? "Ready to run locally." : "JavaScript can run locally; other languages are ready to submit.";
    shadow.querySelector("[data-result]").className = "result";
  }

  function setView(view) {
    const solve = view === "solve";
    shadow.querySelector("[data-split]").style.display = solve ? "grid" : "none";
    shadow.querySelector(".notes-pane").classList.toggle("active", !solve);
    shadow.querySelectorAll("[data-view]").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  }

  function bindEvents() {
    shadow.addEventListener("click", async (event) => {
      const viewControl = event.target.closest("[data-view]");
      if (viewControl) return setView(viewControl.dataset.view);

      const testTab = event.target.closest("[data-test-index]");
      if (testTab) {
        saveActiveTest();
        activeTest = Number(testTab.dataset.testIndex);
        refreshTests();
        return;
      }

      const action = event.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "close") closeWorkspace();
      if (action.dataset.action === "open-original") closeWorkspace();
      if (action.dataset.action === "add-test") addTest();
      if (action.dataset.action === "run-test") runTest();
      if (action.dataset.action === "submit") submitCode();
    });

    shadow.querySelector("[data-language]").addEventListener("change", (event) => {
      saveActiveTest();
      state.codeByLanguage[state.language] = shadow.querySelector("[data-code]").value;
      state.language = event.target.value;
      if (!state.codeByLanguage[state.language]) state.codeByLanguage[state.language] = core.starterCode(state.language, metadata.title);
      refreshEditor();
      refreshTests();
      queueSave();
    });

    shadow.querySelector("[data-code]").addEventListener("input", () => {
      state.codeByLanguage[state.language] = shadow.querySelector("[data-code]").value;
      updateLineNumbers();
      updateCodeStats();
      queueSave();
    });
    shadow.querySelector("[data-code]").addEventListener("scroll", updateLineNumbers);
    shadow.querySelector("[data-code]").addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const target = event.target;
        const start = target.selectionStart;
        target.setRangeText("    ", start, target.selectionEnd, "end");
        target.dispatchEvent(new Event("input"));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runTest();
      }
    });

    shadow.querySelector("[data-notes]").addEventListener("input", (event) => {
      state.notes = event.target.value;
      queueSave();
    });
    shadow.querySelector("[data-test-input]").addEventListener("input", (event) => {
      state.tests[activeTest].input = event.target.value;
      queueSave();
    });
    shadow.querySelector("[data-test-output]").addEventListener("input", (event) => {
      state.tests[activeTest].output = event.target.value;
      queueSave();
    });

    const handle = shadow.querySelector("[data-drag-handle]");
    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      handle.classList.add("dragging");
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const split = shadow.querySelector("[data-split]");
      const rect = split.getBoundingClientRect();
      const ratio = Math.min(70, Math.max(25, ((event.clientX - rect.left) / rect.width) * 100));
      state.split = Math.round(ratio);
      split.style.setProperty("--split", `${state.split}%`);
    });
    handle.addEventListener("pointerup", (event) => {
      dragging = false;
      handle.classList.remove("dragging");
      handle.releasePointerCapture(event.pointerId);
      queueSave();
    });
  }

  function saveActiveTest() {
    const input = shadow && shadow.querySelector("[data-test-input]");
    const output = shadow && shadow.querySelector("[data-test-output]");
    if (!input || !output || !state.tests[activeTest]) return;
    state.tests[activeTest].input = input.value;
    state.tests[activeTest].output = output.value;
  }

  function addTest() {
    saveActiveTest();
    const number = state.tests.length + 1;
    state.tests.push({ id: `custom-${Date.now()}`, label: `Custom ${number}`, input: "", output: "" });
    activeTest = state.tests.length - 1;
    refreshTests();
    queueSave();
  }

  function runTest() {
    saveActiveTest();
    const resultNode = shadow.querySelector("[data-result]");
    const test = state.tests[activeTest];
    if (state.language !== "javascript") {
      resultNode.className = "result";
      resultNode.textContent = "Local execution currently supports JavaScript. Submit other languages to Codeforces.";
      return;
    }
    const result = core.executeJavaScript(currentCode(), test.input || "");
    if (!result.ok) {
      resultNode.className = "result fail";
      resultNode.textContent = `Runtime error: ${result.error}`;
      return;
    }
    const passed = core.compareOutputs(result.output, test.output || "");
    resultNode.className = `result ${passed ? "ok" : "fail"}`;
    resultNode.textContent = passed ? "✓ Passed" : `✕ Wrong answer · got “${core.normalizeOutput(result.output) || "(empty)"}”`;
  }

  async function submitCode() {
    saveActiveTest();
    await storageSet(pendingKey, {
      code: currentCode(),
      language: state.language,
      problem: { area: metadata.area, groupId: metadata.groupId, contestId: metadata.contestId, index: metadata.index },
      createdAt: Date.now()
    });
    window.location.href = core.submitPath(metadata);
  }

  function closeWorkspace() {
    if (host) host.remove();
    document.documentElement.style.overflow = "";
  }

  async function showSubmissionHandoff() {
    const pending = await storageGet(pendingKey);
    if (!pending || !pending.code || !/\/submit(?:\/|$)/i.test(window.location.pathname)) return;
    const fill = () => {
      const source = document.querySelector("textarea[name='source'], textarea#sourceCode, textarea#sourceCodeTextarea, textarea[name='sourceCode']");
      const select = document.querySelector("select[name='programTypeId'], select[name='programType']");
      if (!source) return false;
      source.value = pending.code;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      source.dispatchEvent(new Event("change", { bubbles: true }));
      if (pending.problem) {
        const problemSelect = document.querySelector("select[name='submittedProblemIndex']");
        const problemCode = document.querySelector("input[name='submittedProblemCode']");
        if (problemSelect && pending.problem.index) {
          const option = Array.from(problemSelect.options).find((item) => item.value === pending.problem.index || item.textContent.trim().startsWith(`${pending.problem.index}.`));
          if (option) {
            problemSelect.value = option.value;
            problemSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        if (problemCode && pending.problem.contestId && pending.problem.index) {
          problemCode.value = `${pending.problem.contestId}${pending.problem.index}`;
          problemCode.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (select) {
        const options = Array.from(select.options);
        const matcher = pending.language === "cpp"
          ? (text) => /(?:g\+\+|c\+\+|clang)/i.test(text)
          : pending.language === "python"
            ? (text) => /python\s*3|pypy\s*3/i.test(text)
            : pending.language === "java"
              ? (text) => /java(?!script)/i.test(text)
              : (text) => /javascript|node\.js/i.test(text);
        const candidates = options.filter((item) => matcher(item.textContent));
        const option = candidates.find((item) => /17|20|3\.x|node/i.test(item.textContent)) || candidates[0];
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      showHandoffBanner(pending);
      return true;
    };
    if (fill()) return;
    const observer = new MutationObserver(() => { if (fill()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function showHandoffBanner(pending) {
    if (document.querySelector("[data-leetify-handoff]")) return;
    const banner = document.createElement("div");
    banner.dataset.leetifyHandoff = "true";
    banner.textContent = `Leetify loaded your ${core.getLanguage(pending.language).label} draft. Review it, then submit normally.`;
    Object.assign(banner.style, { position: "fixed", zIndex: "2147483647", right: "18px", bottom: "18px", maxWidth: "360px", padding: "12px 15px", border: "1px solid #4eb78d", borderRadius: "7px", color: "#dff9ed", background: "#123b32", boxShadow: "0 8px 25px #0006", font: "13px/1.4 system-ui, sans-serif" });
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
    storageSet(pendingKey, null);
  }

  async function init() {
    if (!metadata) {
      await showSubmissionHandoff();
      return;
    }
    await loadState();
    render();
  }

  if (typeof browser !== "undefined" && browser.runtime) {
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.type === "leetify-toggle") {
        if (host) closeWorkspace();
        else init();
      }
    });
  }

  init();
})();
