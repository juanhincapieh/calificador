require('dotenv').config({ path: '.env.local' });

async function main() {
  const url = 'https://docs.google.com/spreadsheets/d/1y2jClssIZNVAxpMsEJOL88AdG3tEAUrB025oSV4cwsc/export?format=csv&gid=1633164906';
  const res = await fetch(url);
  console.log('Status:', res.status);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim());
  console.log('Total filas:', lines.length);
  console.log('Header:', lines[0]);

  // Parsear
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  console.log('\nHeaders parseados:', JSON.stringify(headers));

  const rows = lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]));
  });

  // Buscar COLBOYT336
  const matches = rows.filter(r => {
    const t = (r['Terreno'] || '').trim();
    return t.toUpperCase() === 'COLBOYT336';
  });

  console.log('\nFilas que coinciden con COLBOYT336:', matches.length);
  matches.forEach((m, i) => {
    console.log(`  Fila ${i + 1}:`, JSON.stringify({
      Terreno: m['Terreno'],
      'Cantidad de minigranjas': m['Cantidad de minigranjas'],
      'Capacidad SE': m['Capacidad SE'],
    }));
  });
}

main().catch(e => console.error(e));
