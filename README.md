# Leetify for Codeforces — Firefox

A polished Firefox WebExtension that turns Codeforces problem pages into a focused solving workspace inspired by modern coding practice tools.

## Included in this first release

- LeetCode-inspired dark workspace with a compact rail, problem sidebar, focused typography, and a resizable statement/editor split.
- C++17, Python 3, Java 17, and JavaScript draft templates.
- Lightweight syntax highlighting with line numbers, tab indentation, reset, and language-aware starter code.
- Per-problem drafts, notes, language selection, split position, bookmarks, solved state, attempt count, samples, and custom tests saved in Firefox storage.
- Sandboxed Web Worker JavaScript runner with timeout protection and whitespace-normalized output comparison; other languages hand off to Codeforces.
- Testcase rename, duplicate, delete, reorder, and custom testcase support.
- One-click handoff to the native Codeforces submission page, including code and language selection.
- Submission form/Ace editor filling, native submission attempt tracking, visible verdict state, and Codeforces status-page polling.
- Difficulty and topic tags read from the Codeforces page.
- Works on problemset, contest, and gym problem routes.
- My Notes view with prompts for observations, invariants, mistakes, complexity, and editorial insights.
- Progress view with streak, solved, attempts, notes, and topic-strength values derived from local state and history.
- Searchable notes dashboard in the extension options page, with problem links and local revision queues.
- Training view with unfinished practice, topic focus, and solved-problem revision queues derived from saved activity.
- Solved/attempted badges on Codeforces problemset and contest links when matching local history exists.
- Firefox toolbar icons, keyboard navigation, focus restoration, responsive layout, and an options-page help/privacy guide.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Select this repository's `manifest.json`.
4. Open a Codeforces problem page. The workspace opens automatically.

The extension has no build step and uses only WebExtension APIs available in Firefox.

## First run and help

Open **Leetify for Codeforces — Help and privacy** from the extension's options page for setup steps, keyboard shortcuts, accessibility details, and data controls. In the workspace, **Quick help** in the problem sidebar provides the same essential shortcuts.

- `Tab` inserts four spaces in the code editor.
- `Ctrl/Cmd + Enter` runs the selected test case.
- `Escape` closes the workspace and restores focus to the Codeforces page.
- Arrow keys move between view/test tabs; the statement/editor divider is keyboard-resizable.

## Development checks

```bash
npm test
npm run validate
npm run package-extension
```

The package command creates `dist/leetify-firefox-<version>.xpi` for temporary Firefox loading or submission to Mozilla Add-ons.

## Privacy

Leetify requests `storage`, `activeTab`, and Codeforces page access so it can inject the workspace, save drafts locally, read problem statements, and complete the submission handoff. Drafts, test cases, notes, and preferences remain in Firefox's local extension storage. The extension does not include an analytics service, remote backend, advertising, or data sharing.
