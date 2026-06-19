require("dotenv").config({ path: "C:\\Users\\EQUIPO\\Documents\\Claude\\calificador\\.env.local" });
process.chdir("C:\\Users\\EQUIPO\\Documents\\Claude\\calificador");
const http = require("http");
const terrain = require("C:\\Users\\EQUIPO\\Documents\\Claude\\calificador\\api\\terrain.js");

const server = http.createServer(async (req, res) => {
  const url = require("url");
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === "/api/terrain") {
    req.query = parsed.query;
    let sc = 200; const rh = {};
    const mr = {
      status(c) { sc = c; return this; },
      setHeader(k, v) { rh[k] = v; },
      json(d) { res.writeHead(sc, { ...rh, "Content-Type": "application/json" }); res.end(JSON.stringify(d)); },
      end() { res.writeHead(sc, rh); res.end(); }
    };
    await terrain(req, mr).catch(e => { res.writeHead(500); res.end(e.message); });
    return;
  }
  const fs = require("fs"), path = require("path");
  const fp = path.join("C:\\Users\\EQUIPO\\Documents\\Claude\\calificador", parsed.pathname === "/" ? "index.html" : parsed.pathname);
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(d); });
});
server.listen(3000, () => console.log("OK:3000"));
