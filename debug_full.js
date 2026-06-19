require("dotenv").config({ path: "C:\\Users\\EQUIPO\\Documents\\Claude\\calificador\\.env.local" });
process.chdir("C:\\Users\\EQUIPO\\Documents\\Claude\\calificador");
const { Client } = require("pg");

async function main() {
  const c = new Client({ host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Simulate main query
  const { rows } = await c.query(`
    SELECT t.id AS terrain_id, t.name AS codigo, p.id AS project_id, p.grid_operator_id AS operador_raw
    FROM termsheet_terrain t
    LEFT JOIN minifarm_project p ON p.terrain_id = t.id
    WHERE UPPER(t.name) = 'COLBOYT586'
    ORDER BY p.id DESC NULLS LAST LIMIT 1
  `);
  const row = rows[0];
  console.log("row:", JSON.stringify(row));

  // Civiles scoped to project
  const { rows: civiles } = await c.query(`
    SELECT DISTINCT ON (name) name, value, status
    FROM validation_field
    WHERE (project_id = $2 OR terrain_id = $1)
      AND name = 'Tipo de arreglo'
      AND (value IS NOT NULL AND value != 'Pendiente')
    ORDER BY name, id DESC
  `, [row.terrain_id, row.project_id]);
  console.log("civiles Tipo de arreglo:", JSON.stringify(civiles));

  // Tracker check
  const { rows: trackerRows } = await c.query(`
    SELECT value FROM validation_field
    WHERE (project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1) OR terrain_id = $1)
      AND name = 'Tipo de arreglo'
      AND value IN ('1P', '2P')
      AND value IS NOT NULL
    ORDER BY id DESC LIMIT 1
  `, [row.terrain_id]);
  console.log("trackerRows:", JSON.stringify(trackerRows));

  await c.end();
}
main().catch(console.error);
