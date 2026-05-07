import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 4173);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".webp", "image/webp"],
  [".txt", "text/plain; charset=utf-8"],
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.join(rootDir, pathname);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(rootDir))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let data;
    try {
      data = await fs.readFile(resolved);
    } catch {
      const looksLikeRoute = !path.extname(pathname);
      if (!looksLikeRoute) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const indexPath = path.join(rootDir, "index.html");
      data = await fs.readFile(indexPath);
    }

    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(ext) || "application/octet-stream",
    });
    res.end(data);
  } catch (error) {
    res.writeHead(500);
    res.end(error instanceof Error ? error.message : "Server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving ${rootDir} on http://127.0.0.1:${port}`);
});
