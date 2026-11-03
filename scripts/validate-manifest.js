const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const required = ["manifest_version", "name", "version", "description", "icons", "browser_action", "content_scripts", "background", "options_ui"];
for (const key of required) {
  if (!(key in manifest)) throw new Error(`manifest.json is missing ${key}`);
}
if (manifest.manifest_version !== 2) throw new Error("This project currently targets Firefox WebExtensions with manifest version 2.");
if (manifest.version !== packageJson.version) throw new Error(`Manifest version ${manifest.version} does not match package version ${packageJson.version}.`);
if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.includes("none")) {
  throw new Error("Firefox data collection permissions must explicitly declare required: [\"none\"].");
}
for (const file of ["src/core.js", "src/runner.js", "src/testcases.js", "src/history.js", "src/content.js", "src/background.js", "src/content.css"]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing extension file: ${file}`);
}
for (const [size, file] of Object.entries(manifest.icons)) {
  if (!/^\d+$/.test(size) || !/^icons\/.+\.png$/i.test(file)) throw new Error(`Invalid icon declaration for ${size}: ${file}`);
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing extension icon: ${file}`);
}
for (const [size, file] of Object.entries(manifest.browser_action.default_icon || {})) {
  if (!manifest.icons[size] || manifest.icons[size] !== file) throw new Error(`Browser action icon ${size} must reference a declared extension icon.`);
}
if (!Array.isArray(manifest.content_scripts) || !manifest.content_scripts.length) throw new Error("Manifest must declare at least one content script.");
for (const contentScript of manifest.content_scripts) {
  for (const file of [...(contentScript.js || []), ...(contentScript.css || [])]) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing content script asset: ${file}`);
  }
  if (!contentScript.matches?.some((match) => /codeforces\.com/.test(match))) throw new Error("Content scripts must be scoped to Codeforces.");
}
if (manifest.options_ui.page !== "options/options.html" || !fs.existsSync(path.join(root, manifest.options_ui.page))) {
  throw new Error("Manifest options_ui must point to options/options.html.");
}
console.log(`Validated Firefox extension manifest for ${manifest.name} v${manifest.version} with ${Object.keys(manifest.icons).length} icons.`);
