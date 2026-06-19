require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
async function main() {
  const c = new Client({ host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`
    SELECT value FROM validation_field
    WHERE (project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1) OR terrain_id = $1)
      AND name = 'Tipo de arreglo'
      AND value IN ('1P', '2P')
      AND value IS NOT NULL
    ORDER BY id DESC LIMIT 1
  `, [6465]);
  console.log("trackerRows:", JSON.stringify(rows));
  await c.end();
}
main().catch(console.error);
