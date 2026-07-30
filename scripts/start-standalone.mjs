import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const port = process.argv[2] || process.env.PORT || "3000";
process.env.PORT = port;
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";

const standaloneRoot = path.join(process.cwd(), ".next", "standalone");
const standaloneStatic = path.join(standaloneRoot, ".next", "static");
if (!existsSync(standaloneStatic)) {
  mkdirSync(path.dirname(standaloneStatic), { recursive: true });
  cpSync(path.join(process.cwd(), ".next", "static"), standaloneStatic, { recursive: true });
}
const standalonePublic = path.join(standaloneRoot, "public");
if (!existsSync(standalonePublic)) {
  cpSync(path.join(process.cwd(), "public"), standalonePublic, { recursive: true });
}

process.chdir(standaloneRoot);

await import(pathToFileURL(path.join(standaloneRoot, "server.js")).href);
