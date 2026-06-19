require("dotenv").config({ path: "C:\\Users\\EQUIPO\\Documents\\Claude\\calificador\\.env.local" });
const { Client } = require("pg");
async function main() {
  const c = new Client({ host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  await c.connect();
  const { rows } = await c.query("SELECT 1 AS ok");
  console.log("BD OK:", rows[0]);
  await c.end();
}
main().catch(e => console.error("BD ERROR:", e.message));
