(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const extensionGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  const core = extensionGlobal.LeetifyCore || window.LeetifyCore;

  if (!core) return;

  const stateKey = (key) => `leetify:state:${key}`;
  const pendingKey = "leetify:pending-submission";
  let host;
  let shadow;
  let state;
  let metadata;
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
      :host { color: #eff1f6; }
      .app { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; color: #eff1f6; background: #1a1a1a; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .topbar { height: 52px; flex: 0 0 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid #3a3a3a; background: #282828; }
      .topbar-left, .topbar-right, .brand, .problem-heading { display: flex; align-items: center; }
      .topbar-left { min-width: 0; gap: 14px; }
      .topbar-right { gap: 10px; }
      .brand { gap: 9px; min-width: 122px; }
      .brand-mark { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 6px; color: #1a1a1a; background: #ffa116; font-size: 14px; font-weight: 900; }
      .brand-title { color: #f5f5f5; font-size: 14px; font-weight: 700; letter-spacing: -.01em; }
      .brand-subtitle { margin-top: 1px; color: #9b9b9b; font-size: 9px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
      .topbar-divider { width: 1px; height: 22px; background: #484848; }
      .problem-heading { min-width: 0; gap: 8px; }
      .problem-id { color: #ffa116; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
      .problem-title { max-width: min(42vw, 560px); overflow: hidden; color: #f0f0f0; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      button, select { border: 1px solid #4b4b4b; border-radius: 5px; color: #eff1f6; background: #333333; cursor: pointer; }
      button { padding: 7px 11px; font-size: 12px; font-weight: 600; transition: background .15s, border-color .15s, color .15s, transform .15s; }
      button:hover { border-color: #777; background: #414141; }
      button:active { transform: translateY(1px); }
      button.primary { border-color: #ffa116; color: #1a1a1a; background: #ffa116; }
      button.primary:hover { border-color: #ffb84d; background: #ffb84d; }
      button.success { border-color: #2db55d; color: #eafff0; background: #245b3a; }
      button.ghost, button.icon-btn { border-color: transparent; color: #a8a8a8; background: transparent; }
      button.icon-btn { width: 30px; padding: 5px; font-size: 17px; }
      button.icon-btn.bookmarked { color: #ffa116; }
      .save-state { color: #8f8f8f; font-size: 11px; }
      .body { min-height: 0; display: flex; flex: 1; }
      .rail { width: 54px; flex: 0 0 54px; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 12px 0; border-right: 1px solid #373737; background: #202020; }
      .rail-btn { width: 36px; height: 36px; padding: 0; border-color: transparent; border-radius: 6px; color: #898989; background: transparent; font-size: 17px; }
      .rail-btn:hover { color: #e5e5e5; background: #333; }
      .rail-btn.active { color: #ffa116; background: #3b2d1c; }
      .rail-spacer { flex: 1; }
      .rail-symbol { display: block; line-height: 1; }
      .problem-sidebar { width: 220px; flex: 0 0 220px; min-height: 0; overflow-y: auto; border-right: 1px solid #373737; background: #232323; }
      .sidebar-scroll { padding: 18px 12px 20px; }
      .section-label { margin: 12px 8px 8px; color: #818181; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .section-label:first-child { margin-top: 0; }
      .nav-list { display: grid; gap: 3px; }
      .nav-item { display: flex; align-items: center; width: 100%; gap: 9px; padding: 8px 9px; border-color: transparent; color: #b4b4b4; background: transparent; text-align: left; }
      .nav-item:hover { background: #303030; }
      .nav-item.active { border-color: #4b3d2a; color: #f2f2f2; background: #3a2d1f; }
      .nav-icon { width: 17px; color: #989898; text-align: center; font-size: 14px; }
      .nav-item.active .nav-icon { color: #ffa116; }
      .meta-card { padding: 12px; margin-top: 15px; border: 1px solid #414141; border-radius: 6px; background: #2b2b2b; }
      .meta-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #999; font-size: 11px; }
      .meta-value { color: #ffa116; font-size: 19px; font-weight: 750; }
      .difficulty-bar { height: 4px; margin: 9px 0 12px; overflow: hidden; border-radius: 4px; background: #454545; }
      .difficulty-bar span { display: block; width: 34%; height: 100%; border-radius: inherit; background: #2db55d; }
      .tag-list { display: flex; flex-wrap: wrap; gap: 5px; }
      .tag { padding: 3px 6px; border: 1px solid #515151; border-radius: 4px; color: #bdbdbd; background: #353535; font-size: 10px; }
      .focus-card { padding: 11px; margin-top: 13px; border-left: 2px solid #ffa116; color: #a5a5a5; background: #2b2b2b; font-size: 11px; line-height: 1.5; }
      .focus-card strong { display: block; margin-bottom: 3px; color: #e1e1e1; font-size: 11px; }
      .side-footer { padding: 12px 8px 0; color: #777; font-size: 10px; line-height: 1.5; }
      .workspace { min-width: 0; min-height: 0; display: flex; flex: 1; flex-direction: column; background: #1a1a1a; }
      .workspace-toolbar { height: 48px; flex: 0 0 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid #383838; background: #202020; }
      .tabs, .toolbar-actions, .editor-tabs, .editor-actions, .test-tabs { display: flex; align-items: center; gap: 6px; }
      .tab { height: 48px; padding: 0 10px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: #929292; background: transparent; }
      .tab:hover { color: #eee; background: transparent; }
      .tab.active { border-bottom-color: #ffa116; color: #f4f4f4; }
      .toolbar-actions { gap: 7px; }
      .split { --split: 45%; min-height: 0; display: grid; grid-template-columns: minmax(300px, var(--split)) 6px minmax(360px, 1fr); flex: 1; }
      .split.statement-collapsed { grid-template-columns: 0 0 minmax(360px, 1fr); }
      .split.statement-collapsed .statement-pane, .split.statement-collapsed .drag-handle { display: none; }
      .statement-pane, .editor-pane { min-width: 0; min-height: 0; overflow: hidden; }
      .statement-pane { overflow-y: auto; padding: 25px clamp(20px, 3vw, 42px) 44px; background: #262626; color: #d6d6d6; }
      .statement-head { display: flex; align-items: center; justify-content: space-between; max-width: 780px; margin: 0 auto 18px; padding-bottom: 12px; border-bottom: 1px solid #414141; }
      .eyebrow { color: #949494; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .statement-pane .problem-statement { max-width: 780px; margin: 0 auto; font-size: 14px; line-height: 1.65; }
      .statement-pane .header { padding-bottom: 18px; margin-bottom: 20px; border-bottom: 1px solid #414141; }
      .statement-pane .header .title { margin-bottom: 12px; color: #f2f2f2; font-size: 25px; font-weight: 700; line-height: 1.22; }
      .statement-pane .time-limit, .statement-pane .memory-limit, .statement-pane .input-file, .statement-pane .output-file { display: inline-block; margin: 0 18px 0 0; color: #a7a7a7; font-size: 11px; }
      .statement-pane .property-title, .statement-pane .section-title { color: #888; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .statement-pane .section-title { margin-top: 23px; margin-bottom: 5px; }
      .statement-pane a { color: #ffa116; }
      .statement-pane code, .statement-pane .tex-font-style-tt { padding: 1px 4px; border-radius: 3px; color: #e8e8e8; background: #3a3a3a; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .statement-pane pre { padding: 12px 14px; overflow-x: auto; border: 1px solid #444; border-radius: 5px; color: #e4e4e4; background: #1d1d1d; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .statement-pane .sample-test { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
      .statement-pane .sample-test .title { margin-top: 8px; color: #a9a9a9; font-size: 11px; font-weight: 650; }
      .drag-handle { position: relative; z-index: 2; cursor: col-resize; background: #3a3a3a; }
      .drag-handle:hover, .drag-handle.dragging { background: #ffa116; }
      .editor-pane { display: flex; flex-direction: column; background: #1f1f1f; }
      .editor-header { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 7px 12px; border-bottom: 1px solid #3c3c3c; background: #252525; }
      .editor-tabs { height: 34px; }
      .editor-tab { height: 34px; padding: 0 10px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: #999; background: transparent; }
      .editor-tab.active { border-bottom-color: #ffa116; color: #f3f3f3; }
      .editor-actions { gap: 7px; }
      select { min-width: 118px; padding: 7px 26px 7px 9px; outline: 0; font-size: 11px; }
      select:focus, .test-input:focus, .notes-input:focus { border-color: #ffa116; }
      .code-wrap { min-height: 220px; display: grid; grid-template-columns: 44px 1fr; flex: 1; background: #1f1f1f; }
      .line-numbers { padding: 15px 10px 15px 0; overflow: hidden; color: #666; background: #1c1c1c; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: right; user-select: none; }
      .code-input { width: 100%; height: 100%; min-height: 220px; resize: none; padding: 15px 16px; border: 0; outline: 0; color: #e5e5e5; background: transparent; caret-color: #ffa116; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; tab-size: 4; white-space: pre; }
      .code-input::selection, .notes-input::selection { color: #fff; background: #5a4024; }
      .editor-footer { display: flex; align-items: center; justify-content: space-between; padding: 7px 13px; border-top: 1px solid #383838; color: #777; font-size: 10px; }
      .test-panel { min-height: 194px; max-height: 42%; display: flex; flex-direction: column; border-top: 1px solid #424242; background: #262626; }
      .test-header { display: flex; align-items: center; min-height: 43px; gap: 9px; padding: 7px 12px 0; border-bottom: 1px solid #3b3b3b; }
      .test-title { margin-right: 5px; color: #e6e6e6; font-size: 12px; font-weight: 700; }
      .test-tabs { min-width: 0; overflow-x: auto; }
      .test-tab { padding: 5px 8px; border: 0; color: #999; background: transparent; font-size: 11px; white-space: nowrap; }
      .test-tab.active { color: #ffa116; }
      .test-body { min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 11px; padding: 10px 12px 12px; flex: 1; }
      .test-field { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
      .test-field label { color: #8d8d8d; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
      .test-input, .notes-input { width: 100%; min-height: 80px; resize: vertical; padding: 9px; border: 1px solid #484848; border-radius: 5px; outline: 0; color: #d7d7d7; background: #1d1d1d; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .result { min-height: 18px; color: #898989; font-size: 11px; }
      .result.ok { color: #4bd37a; }
      .result.fail { color: #ff7b72; }
      .notes-pane, .analytics-pane, .training-pane { display: none; min-height: 0; flex: 1; overflow: auto; padding: 32px clamp(24px, 5vw, 72px); background: #1f1f1f; }
      .notes-pane.active, .analytics-pane.active, .training-pane.active { display: block; }
      .page-heading { max-width: 920px; margin: 0 auto 22px; }
      .page-heading h2 { margin: 0 0 6px; color: #f5f5f5; font-size: 24px; font-weight: 700; }
      .page-heading p { margin: 0; color: #999; font-size: 12px; }
      .notes-grid { max-width: 920px; display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 16px; margin: 0 auto; }
      .notes-input { min-height: 390px; padding: 18px; font-family: inherit; font-size: 13px; line-height: 1.7; }
      .note-prompts, .metric-card, .training-card { padding: 15px; border: 1px solid #414141; border-radius: 6px; background: #282828; }
      .note-prompts h3, .training-card h3 { margin: 0 0 12px; color: #dedede; font-size: 12px; }
      .prompt { display: block; width: 100%; padding: 8px 0; border: 0; border-top: 1px solid #3d3d3d; border-radius: 0; color: #9f9f9f; background: transparent; font-size: 11px; text-align: left; }
      .prompt:hover { color: #ffa116; background: transparent; }
      .metric-grid { max-width: 920px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; margin: 0 auto 22px; }
      .metric-label { color: #929292; font-size: 11px; }
      .metric-value { display: block; margin-top: 7px; color: #f2f2f2; font-size: 24px; font-weight: 750; }
      .metric-value.orange { color: #ffa116; }
      .metric-value.green { color: #4bd37a; }
      .chart-card { max-width: 920px; padding: 18px; margin: 0 auto; border: 1px solid #414141; border-radius: 6px; background: #282828; }
      .chart-title { display: flex; justify-content: space-between; margin-bottom: 16px; color: #dedede; font-size: 12px; font-weight: 700; }
      .bar-row { display: grid; grid-template-columns: 95px 1fr 42px; align-items: center; gap: 10px; margin: 10px 0; color: #999; font-size: 11px; }
      .bar { height: 7px; overflow: hidden; border-radius: 5px; background: #3e3e3e; }
      .bar span { display: block; height: 100%; border-radius: inherit; background: #ffa116; }
      .training-grid { max-width: 920px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; margin: 0 auto; }
      .training-card { min-height: 160px; }
      .training-card p { color: #999; font-size: 11px; line-height: 1.55; }
      .training-link { display: inline-block; margin-top: 5px; color: #ffa116; font-size: 11px; }
      .solved-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: 4px; color: #4bd37a; background: #203e2a; font-size: 10px; font-weight: 700; }
      .hidden { display: none !important; }
      @media (max-width: 1050px) { .problem-sidebar { width: 190px; flex-basis: 190px; } .metric-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 800px) { .problem-sidebar { display: none; } .problem-title { max-width: 35vw; } .split { grid-template-columns: 1fr; grid-template-rows: minmax(280px, 45%) 6px minmax(390px, 1fr); } .drag-handle { cursor: row-resize; } .training-grid, .notes-grid { grid-template-columns: 1fr; } }
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
      split: 46,
      solved: false,
      bookmarked: false,
      attempts: 0
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
    refreshProblemStatus();
  }

  function appTemplate() {
    const tags = metadata.tags.length ? metadata.tags : ["unclassified"];
    return `<div class="app" role="application" aria-label="Leetify Codeforces workspace">
      <header class="topbar">
        <div class="topbar-left"><div class="brand"><div class="brand-mark">L</div><div><div class="brand-title">Leetify</div><div class="brand-subtitle">For Codeforces</div></div></div><span class="topbar-divider"></span><div class="problem-heading"><span class="problem-id">${escapeHtml(metadata.label)}</span><span class="problem-title">${escapeHtml(metadata.title)}</span><span data-solved-label class="solved-pill hidden">✓ Solved</span></div></div>
        <div class="topbar-right"><span class="save-state" data-save-state>Saved locally</span><button class="icon-btn" data-action="bookmark" data-bookmark title="Bookmark problem">☆</button><button class="ghost" data-action="close" title="Close workspace">Close</button></div>
      </header>
      <div class="body">
        <aside class="rail"><button class="rail-btn active" data-view="solve" title="Workspace"><span class="rail-symbol">⌘</span></button><button class="rail-btn" data-view="notes" title="My Notes"><span class="rail-symbol">▤</span></button><button class="rail-btn" data-view="analytics" title="Analytics"><span class="rail-symbol">◔</span></button><button class="rail-btn" data-view="training" title="Training"><span class="rail-symbol">↗</span></button><div class="rail-spacer"></div><button class="rail-btn" data-action="open-original" title="Open original Codeforces page"><span class="rail-symbol">↗</span></button></aside>
        <aside class="problem-sidebar"><div class="sidebar-scroll"><div class="section-label">Workspace</div><nav class="nav-list"><button class="nav-item active" data-view="solve"><span class="nav-icon">⌘</span>Workspace</button><button class="nav-item" data-view="notes"><span class="nav-icon">▤</span>My notes</button><button class="nav-item" data-view="analytics"><span class="nav-icon">◔</span>Analytics</button><button class="nav-item" data-view="training"><span class="nav-icon">↗</span>Training plan</button></nav><div class="section-label">Problem</div><div class="meta-card"><div class="meta-row"><span>Difficulty</span><strong class="meta-value">${escapeHtml(metadata.rating)}</strong></div><div class="difficulty-bar"><span></span></div><div class="tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div><div class="focus-card"><strong>Practice focus</strong>Build the invariant first, then test the smallest edge case. Your notes and attempts stay attached to this problem.</div><button class="nav-item" data-action="mark-solved" style="margin-top:12px"><span class="nav-icon">✓</span><span data-mark-solved-label>Mark as solved</span></button><div class="side-footer">Drafts, test cases, and notes are saved locally in Firefox.</div></div></aside>
        <main class="workspace">
          <div class="workspace-toolbar"><div class="tabs"><button class="tab active" data-view="solve">Workspace</button><button class="tab" data-view="notes">Problem notes</button><button class="tab" data-view="analytics">Progress</button></div><div class="toolbar-actions"><button class="ghost" data-action="open-original">Open original</button><button class="primary" data-action="submit">Submit</button></div></div>
          <section class="split" data-split><article class="statement-pane"><div class="statement-head"><span class="eyebrow">Problem statement</span><button class="ghost" data-action="collapse-statement">Collapse</button></div><div data-statement-slot></div></article><div class="drag-handle" data-drag-handle title="Drag to resize"></div><section class="editor-pane"><div class="editor-header"><div class="editor-tabs"><button class="editor-tab active">Code</button><button class="editor-tab" data-view="notes">Notes</button></div><div class="editor-actions"><button class="icon-btn" data-action="reset-code" title="Reset starter code">↺</button><select data-language aria-label="Programming language">${Object.entries(core.LANGUAGES).map(([id, language]) => `<option value="${id}" ${state.language === id ? "selected" : ""}>${language.label}</option>`).join("")}</select><button class="primary" data-action="run-test">Run</button></div></div><div class="code-wrap"><div class="line-numbers" data-line-numbers></div><textarea class="code-input" data-code spellcheck="false" aria-label="Solution code"></textarea></div><div class="editor-footer"><span>Tab inserts spaces · Ctrl/Cmd + Enter runs</span><span data-code-stats></span></div><div class="test-panel"><div class="test-header"><span class="test-title">Testcase</span><div class="test-tabs" data-test-tabs></div><button class="ghost" data-action="add-test">+ Add testcase</button></div><div class="test-body"><div class="test-field"><label for="test-input">Input</label><textarea id="test-input" class="test-input" data-test-input spellcheck="false"></textarea></div><div class="test-field"><label for="test-output">Expected output</label><textarea id="test-output" class="test-input" data-test-output spellcheck="false"></textarea><div class="result" data-result>JavaScript is available for local runs. Submit other languages to Codeforces.</div></div></div></div></section></section>
          <section class="notes-pane"><div class="page-heading"><h2>My notes</h2><p>Keep the observation, mistake, or reusable pattern you want to remember for ${escapeHtml(metadata.label)}.</p></div><div class="notes-grid"><textarea class="notes-input" data-notes placeholder="What is the key idea? What did you try? What should you remember?"></textarea><div class="note-prompts"><h3>Useful prompts</h3><button class="prompt" data-prompt="Observation: ">Observation</button><button class="prompt" data-prompt="Invariant: ">Invariant</button><button class="prompt" data-prompt="Mistake: ">Mistake</button><button class="prompt" data-prompt="Complexity: ">Complexity</button><button class="prompt" data-prompt="Editorial insight: ">Editorial insight</button></div></div></section>
          <section class="analytics-pane"><div class="page-heading"><h2>Your progress</h2><p>A private view of the habits you build while solving Codeforces problems in Leetify.</p></div><div class="metric-grid"><div class="metric-card"><span class="metric-label">Current streak</span><strong class="metric-value orange" data-metric-streak>1 day</strong></div><div class="metric-card"><span class="metric-label">Problems solved</span><strong class="metric-value green" data-metric-solved>0</strong></div><div class="metric-card"><span class="metric-label">Attempts here</span><strong class="metric-value" data-metric-attempts>0</strong></div><div class="metric-card"><span class="metric-label">Growth zone</span><strong class="metric-value">${escapeHtml(metadata.rating)}</strong></div></div><div class="chart-card"><div class="chart-title"><span>Topic strength</span><span style="color:#888;font-weight:400">Local estimate</span></div><div class="bar-row"><span>implementation</span><div class="bar"><span style="width:72%"></span></div><b>72%</b></div><div class="bar-row"><span>${escapeHtml(tags[0] || "algorithms")}</span><div class="bar"><span style="width:54%"></span></div><b>54%</b></div><div class="bar-row"><span>problem solving</span><div class="bar"><span style="width:38%"></span></div><b>38%</b></div></div></section>
          <section class="training-pane"><div class="page-heading"><h2>Training plan</h2><p>Practice recommendations around the difficulty and topics of this problem.</p></div><div class="training-grid"><div class="training-card"><h3>Growth zone</h3><p>Problems near your current band. Build consistency with familiar patterns and clean implementations.</p><a class="training-link" href="/problemset?tags=${encodeURIComponent(tags[0] || "implementation")}" target="_blank">Browse similar →</a></div><div class="training-card"><h3>Stretch zone</h3><p>Push one concept beyond your comfort zone. Use the statement first, then write down the invariant.</p><a class="training-link" href="/problemset?order=BY_RATING" target="_blank">Find a challenge →</a></div><div class="training-card"><h3>Revision queue</h3><p>Come back to this problem after your note is complete. Mark it solved to keep your personal streak honest.</p><button class="ghost" data-action="mark-solved">Add to revision queue</button></div></div></section>
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
    shadow.querySelector(".notes-pane").classList.toggle("active", view === "notes");
    shadow.querySelector(".analytics-pane").classList.toggle("active", view === "analytics");
    shadow.querySelector(".training-pane").classList.toggle("active", view === "training");
    shadow.querySelectorAll("[data-view]").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  }

  function refreshProblemStatus() {
    shadow.querySelector("[data-bookmark]").classList.toggle("bookmarked", Boolean(state.bookmarked));
    shadow.querySelector("[data-bookmark]").textContent = state.bookmarked ? "★" : "☆";
    shadow.querySelector("[data-solved-label]").classList.toggle("hidden", !state.solved);
    shadow.querySelectorAll("[data-mark-solved-label]").forEach((element) => {
      element.textContent = state.solved ? "Solved" : "Mark as solved";
    });
    shadow.querySelector("[data-metric-solved]").textContent = state.solved ? "1" : "0";
    shadow.querySelector("[data-metric-attempts]").textContent = String(state.attempts || 0);
  }

  function toggleSolved() {
    state.solved = !state.solved;
    refreshProblemStatus();
    queueSave();
  }

  function bindEvents() {
    shadow.addEventListener("click", async (event) => {
      const viewControl = event.target.closest("[data-view]");
      if (viewControl) return setView(viewControl.dataset.view);

      const prompt = event.target.closest("[data-prompt]");
      if (prompt) {
        const notes = shadow.querySelector("[data-notes]");
        notes.value += `${notes.value && !notes.value.endsWith("\n") ? "\n\n" : ""}${prompt.dataset.prompt}`;
        notes.focus();
        state.notes = notes.value;
        queueSave();
        return;
      }

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
      if (action.dataset.action === "bookmark") {
        state.bookmarked = !state.bookmarked;
        refreshProblemStatus();
        queueSave();
      }
      if (action.dataset.action === "mark-solved") toggleSolved();
      if (action.dataset.action === "collapse-statement") {
        shadow.querySelector("[data-split]").classList.toggle("statement-collapsed");
      }
      if (action.dataset.action === "reset-code") {
        state.codeByLanguage[state.language] = core.starterCode(state.language, metadata.title);
        refreshEditor();
        queueSave();
      }
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
    state.attempts = (state.attempts || 0) + 1;
    refreshProblemStatus();
    queueSave();
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
    host = null;
    shadow = null;
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
    const currentMetadata = core && core.parseProblemMetadata(document, window.location);
    if (!currentMetadata) {
      await showSubmissionHandoff();
      return;
    }
    if (host) return;
    metadata = currentMetadata;
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
  setTimeout(() => {
    if (!host && core && core.parseProblemUrl(window.location.pathname) && document.querySelector(".problem-statement")) init();
  }, 750);
})();
