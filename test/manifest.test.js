const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("manifest declares the Firefox package and local privacy policy", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.browser_specific_settings.gecko.data_collection_permissions.required[0], "none");
  assert.equal(manifest.options_ui.page, "options/options.html");
  assert.ok(manifest.description.length > 20);
});

test("manifest icon assets and extension entry points exist", () => {
  for (const file of Object.values(manifest.icons)) assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  for (const file of Object.values(manifest.browser_action.default_icon)) assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  for (const file of ["src/core.js", "src/content.js", "src/background.js", "src/content.css", manifest.options_ui.page]) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
});

test("content scripts stay scoped to Codeforces pages", () => {
  assert.ok(manifest.content_scripts.length > 0);
  for (const contentScript of manifest.content_scripts) {
    assert.ok(contentScript.matches.every((match) => /codeforces\.com/.test(match)));
  }
});
