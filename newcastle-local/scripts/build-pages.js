const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "public");
const destination = path.resolve(projectRoot, "..", "docs");

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
fs.copyFileSync(path.join(destination, "index.html"), path.join(destination, "404.html"));
fs.writeFileSync(path.join(destination, ".nojekyll"), "");
console.log(`GitHub Pages tayyor: ${destination}`);
