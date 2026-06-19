require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  // First find the terrain_id for COLBOYT586
  const c = new Client({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASS,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const { rows: t } = await c.query(
    "SELECT id FROM termsheet_terrain WHERE UPPER(name) = 'COLBOYT586' LIMIT 1"
  );
  if (!t.length) { console.log("Terreno no encontrado"); await c.end(); return; }
  const tid = t[0].id;
  console.log("terrain_id:", tid);

  const { rows } = await c.query(`
    SELECT id, name, value, status
    FROM validation_field
    WHERE (project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1) OR terrain_id = $1)
      AND name = 'Tipo de arreglo'
    ORDER BY id DESC
    LIMIT 5
  `, [tid]);

  console.log("Registros 'Tipo de arreglo':", JSON.stringify(rows, null, 2));
  await c.end();
}
main().catch(console.error);
