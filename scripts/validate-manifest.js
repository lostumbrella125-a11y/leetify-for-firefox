const fs = require("node:fs");

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const required = ["manifest_version", "name", "version", "content_scripts", "background"];
for (const key of required) {
  if (!(key in manifest)) throw new Error(`manifest.json is missing ${key}`);
}
if (manifest.manifest_version !== 2) throw new Error("This project currently targets Firefox WebExtensions with manifest version 2.");
for (const script of ["src/core.js", "src/content.js", "src/background.js"]) {
  if (!fs.existsSync(script)) throw new Error(`Missing extension script: ${script}`);
}
console.log(`Validated Firefox extension manifest for ${manifest.name} v${manifest.version}.`);
