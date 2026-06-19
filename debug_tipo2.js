require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const c = new Client({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASS,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const { rows } = await c.query(`
    SELECT vf.id, vf.name, vf.value, vf.status, vf.project_id, vf.terrain_id,
           p.stage AS project_stage, p.name AS project_name
    FROM validation_field vf
    LEFT JOIN minifarm_project p ON p.id = vf.project_id
    WHERE (vf.project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = 6465) OR vf.terrain_id = 6465)
      AND vf.name = 'Tipo de arreglo'
    ORDER BY vf.id DESC
  `);
  console.log(JSON.stringify(rows, null, 2));
  await c.end();
}
main().catch(console.error);
