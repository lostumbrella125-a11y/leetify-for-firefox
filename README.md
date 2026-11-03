# Leetify for Codeforces — Firefox

A polished Firefox WebExtension that turns Codeforces problem pages into a focused solving workspace inspired by modern coding practice tools.

## Included in this first release

- LeetCode-inspired dark workspace with a compact rail, problem sidebar, focused typography, and a resizable statement/editor split.
- C++17, Python 3, Java 17, and JavaScript draft templates.
- Per-problem drafts, notes, language selection, split position, bookmarks, solved state, attempt count, samples, and custom tests saved in Firefox storage.
- Built-in JavaScript runner with whitespace-normalized output comparison.
- One-click handoff to the native Codeforces submission page, including code and language selection.
- Difficulty and topic tags read from the Codeforces page.
- Works on problemset, contest, and gym problem routes.
- My Notes view with prompts for observations, invariants, mistakes, complexity, and editorial insights.
- Progress view with streak, solved, attempts, notes, and topic-strength values derived from local state and history.
- Searchable notes dashboard in the extension options page, with problem links and local revision queues.
- Training view with unfinished practice, topic focus, and solved-problem revision queues derived from saved activity.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Select this repository's `manifest.json`.
4. Open a Codeforces problem page. The workspace opens automatically.

The extension has no build step and uses only WebExtension APIs available in Firefox.

## Development checks

```bash
npm test
npm run validate
```

## Privacy

Drafts and notes remain in the browser's local extension storage. The extension only injects into Codeforces pages and does not include an analytics service or remote backend.
