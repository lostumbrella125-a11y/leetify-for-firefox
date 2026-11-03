const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const dist = path.join(root, "dist");
const archive = path.join(dist, `leetify-firefox-${manifest.version}.xpi`);

fs.mkdirSync(dist, { recursive: true });
if (fs.existsSync(archive)) fs.rmSync(archive);
execFileSync("zip", ["-q", "-r", archive, "manifest.json", "src", "options", "icons"], { cwd: root, stdio: "inherit" });
console.log(`Created ${path.relative(root, archive)}`);
