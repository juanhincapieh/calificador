const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });
const http = require("http");
const fs   = require("fs");
const url  = require("url");

const PORT = process.env.PORT || 3000;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === "/api/terrain") {
    req.query = parsed.query;
    const handler = require(path.join(__dirname, "api/terrain.js"));
    let statusCode = 200;
    const resHeaders = {};

    const mockRes = {
      status(code)      { statusCode = code; return this; },
      setHeader(k, v)   { resHeaders[k] = v; },
      json(data) {
        res.writeHead(statusCode, { ...resHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      },
      end() { res.writeHead(statusCode, resHeaders); res.end(); },
    };

    try {
      await handler(req, mockRes);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("\nServidor corriendo en http://localhost:" + PORT + "\n");
});
