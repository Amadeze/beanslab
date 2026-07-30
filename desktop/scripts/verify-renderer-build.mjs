import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const rendererDir = path.join(process.cwd(), "dist", "renderer");
const htmlPath = path.join(rendererDir, "index.html");
const scriptPath = path.join(rendererDir, "app.js");

await Promise.all([stat(htmlPath), stat(scriptPath)]);
const [html, script] = await Promise.all([
  readFile(htmlPath, "utf8"),
  readFile(scriptPath, "utf8"),
]);

if (!html.includes('<script src="app.js"></script>')) {
  throw new Error("Renderer HTML does not load app.js as expected.");
}

const commonJsMarker = /\b(?:Object\.defineProperty\(exports|module\.exports|exports\.|require\s*\()/;
if (commonJsMarker.test(script)) {
  throw new Error("Renderer app.js contains CommonJS output and will open as a blank Electron window.");
}

if (!script.includes("renderer initialization failed")) {
  throw new Error("Renderer recovery screen is missing from the production build.");
}

console.log("Renderer build is browser-safe.");
