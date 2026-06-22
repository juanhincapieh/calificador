const { Client } = require('pg');
const https   = require('https');

const OR_MAP = {
  afinia:         { score: '1',   label: 'Afinia / ESSA / EPM' },
  essa:           { score: '1',   label: 'Afinia / ESSA / EPM' },
  epm:            { score: '1',   label: 'Afinia / ESSA / EPM' },
  enel:           { score: '0.9', label: 'ENEL' },
  cens:           { score: '0.8', label: 'CENS' },
  celsia:         { score: '0.7', label: 'CELSIA' },
  aire:           { score: '0.6', label: 'Aire / EBSA' },
  ebsa:           { score: '0.6', label: 'Aire / EBSA' },
  chec:           { score: '0.5', label: 'CHEC' },
  edeq:           { score: '0.5', label: 'EDEQ' },
  emcali:         { score: '0.4', label: 'EMCALI' },
  enelar:         { score: '0.3', label: 'ENELAR' },
  cedenar:        { score: '0.3', label: 'CEDENAR' },
  enerca:         { score: '0.3', label: 'ENERCA' },
  electrohuila:   { score: '0.2', label: 'Electrohuila' },
  emsa:           { score: '0.2', label: 'EMSA' },
  energuaviare:   { score: '0.2', label: 'Energuaviare' },
  eep:            { score: '0.2', label: 'EEP' },
  cetsa:          { score: '0.1', label: 'CETSA' },
};

const ADECUACION_MAP = {
  'Óptimo':    '1',
  'Muy bueno': '0.8',
  'Aceptable': '0.6',
  'Deficiente':'0.3',
  'Crítico':   '0',
};

const INUNDACION_MAP = {
  'Bajo':    '1',
  'Moderado':'0.6',
  'Alto':    '0.3',
  'Crítico': '0',
};

const CAUCE_MAP = {
  'No Requiere': '1',
  'Requiere':    '0',
};

const ZONA_VECINOS_MAP = {
  enel:   { score: '1',   label: 'ENEL' },
  epc:    { score: '1',   label: 'EPC' },
  emcali: { score: '1',   label: 'EMCALI' },
  aire:   { score: '0.8', label: 'AIRE' },
  afinia: { score: '0.8', label: 'AFINIA' },
  essa:   { score: '0.8', label: 'ESSA' },
  cens:   { score: '0.8', label: 'CENS' },
  atenea: { score: '0.6', label: 'ATENEA' },
  celsia: { score: '0.6', label: 'CELSIA' },
  emsa:   { score: '0.6', label: 'EMSA' },
  chec:   { score: '0.6', label: 'CHEC' },
  ebsa:   { score: '0.6', label: 'EBSA' },
};

const SERVIDUMBRE_MAP = {
  'Propia':         '1',
  'Pública':        '0.5',
  'Ajena':          '0.2',
  'Pública y ajena':'0',
};

const EASEMENT_TYPE_MAP = {
  'own':                { score: '1',   label: 'Propia' },
  'public':             { score: '0.5', label: 'Pública' },
  'foreign':            { score: '0.2', label: 'Ajena' },
  'public_and_foreign': { score: '0',   label: 'Pública y ajena' },
};

const CAR_MAP = {
  // Score 0.9
  'CORPOCESAR':  '0.9', 'CORTOLIMA': '0.9', 'CORPAMAG':  '0.9',
  'CARDIQUE':    '0.9', 'CAR':       '0.9', 'Carder':    '0.9', 'CARDER': '0.9',
  // Score 0.8
  'Corpoboyaca': '0.8', 'CORPOBOYACA': '0.8',
  // Score 0.6
  'CAS': '0.6', 'CSB': '0.6', 'CVS': '0.6', 'CAM': '0.6',
};

const ESTRUCTURA_MAP = {
  '1P':         '1',
  '2P':         '1',
  'Mesa fija':  '0',
};

const COBERTURA_MAP = {
  'Alto':       '1',
  'Medio/Alto': '0.75',
  'Medio':      '0.5',
  'Medio/Bajo': '0.25',
  'Bajo':       '0',
};

function mapTension(raw) {
  if (!raw) return null;
  const kv = parseFloat(raw);
  if (isNaN(kv)) return null;
  if (kv >= 34) return { score: '1',   label: `${raw} kV` };
  if (kv >= 10) return { score: '0.7', label: `${raw} kV` };
  return null;
}

// ── Google Sheets — Capacidad SE ──
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1y2jClssIZNVAxpMsEJOL88AdG3tEAUrB025oSV4cwsc/export?format=csv&gid=1633164906';
let _sheetsCache = null;
let _sheetsCacheAt = 0;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
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
}

async function fetchCapacidadSheet() {
  if (_sheetsCache && (Date.now() - _sheetsCacheAt) < 5 * 60 * 1000) return _sheetsCache;
  const text = await httpsGet(SHEETS_URL);
  _sheetsCache = parseCSV(text);
  _sheetsCacheAt = Date.now();
  return _sheetsCache;
}

function makeClient(dbName) {
  return new Client({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: dbName,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl:      { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout:           8000,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const code = (req.query.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Parámetro code requerido' });

  const main = makeClient(process.env.DB_NAME);

  try {
    await main.connect();


    const { rows } = await main.query(`
      SELECT
        t.id               AS terrain_id,
        t.name             AS codigo,
        t.radiation        AS produccion_especifica,
        p.id               AS project_id,
        p.road_distance    AS distancia_via,
        p.network_distance AS distancia_red,
        p.grid_operator_id AS operador_raw,
        p.name             AS project_name,
        ci.name            AS city_name
      FROM termsheet_terrain t
      LEFT JOIN minifarm_project p   ON p.terrain_id = t.id
      LEFT JOIN territorial_city ci  ON ci.id = t.city_id
      WHERE UPPER(t.name) = $1
      ORDER BY p.id DESC NULLS LAST
      LIMIT 1
    `, [code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: `Terreno "${code}" no encontrado` });
    }

    const row = rows[0];
    const orKey = (row.operador_raw || '').toLowerCase().trim();

    // Extraer ubicación del nombre del proyecto: "COLBOYT336P4_COMBITA_SUR" → "Combita Sur"
    const toTitleCase = s => s.replace(/[_-]/g, ' ')
      .split(' ').filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    let municipio = null;
    if (row.project_name) {
      const idx = row.project_name.indexOf('_');
      if (idx >= 0) municipio = toTitleCase(row.project_name.slice(idx + 1));
    }
    if (!municipio && row.city_name) municipio = row.city_name;

    // Campos civiles desde validation_field
    let adecuacion = null, inundacion = null, cauce = null, servidumbre = null, estructura = null, forestal = null, demanda = null, cobertura = null, coexistencias = null;
    if (row.terrain_id) {
      const { rows: civiles } = await main.query(`
        SELECT DISTINCT ON (name) name, value, status
        FROM validation_field
        WHERE (
          project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1)
          OR terrain_id = $1
        )
          AND name IN ('Adecuación del terreno', 'Riesgo de inundación', 'Ocupación de cauce',
                       'Servidumbre', 'Tipo de arreglo', 'Licencia de aprovechamiento forestal', 'CAR',
                       'Cambio en la cobertura vegetal', 'ANH', 'ANM')
          AND (
            (value IS NOT NULL AND value != 'Pendiente')
            OR (name = 'Ocupación de cauce' AND status = 'exonerated')
            OR (name = 'Licencia de aprovechamiento forestal' AND status = 'exonerated')
          )
        ORDER BY name, id DESC
      `, [row.terrain_id]);

      const fieldMap = Object.fromEntries(civiles.map(c => {
        if (c.name === 'Ocupación de cauce' && c.value == null && c.status === 'exonerated')
          return [c.name, 'No Requiere'];
        if (c.name === 'Licencia de aprovechamiento forestal' && c.value == null && c.status === 'exonerated')
          return [c.name, 'Exonerado'];
        return [c.name, c.value];
      }));

      // Detectar campos con registros en BD pero sin valor válido → pending
      const CIVIL_FIELD_NAMES = [
        'Adecuación del terreno', 'Riesgo de inundación', 'Ocupación de cauce',
        'Servidumbre', 'Tipo de arreglo', 'Licencia de aprovechamiento forestal', 'Cambio en la cobertura vegetal',
        'ANH', 'ANM',
      ];
      const missingFields = CIVIL_FIELD_NAMES.filter(f => fieldMap[f] == null);
      const pendingFields = new Set();
      if (missingFields.length > 0) {
        const { rows: pRows } = await main.query(`
          SELECT DISTINCT name FROM validation_field
          WHERE (project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1) OR terrain_id = $1)
            AND name = ANY($2)
        `, [row.terrain_id, missingFields]);
        pRows.forEach(r => pendingFields.add(r.name));
      }

      if (fieldMap['Adecuación del terreno'] && ADECUACION_MAP[fieldMap['Adecuación del terreno']] != null)
        adecuacion = { score: ADECUACION_MAP[fieldMap['Adecuación del terreno']], label: fieldMap['Adecuación del terreno'] };
      else if (pendingFields.has('Adecuación del terreno'))
        adecuacion = { pending: true };

      if (fieldMap['Riesgo de inundación'] && INUNDACION_MAP[fieldMap['Riesgo de inundación']] != null)
        inundacion = { score: INUNDACION_MAP[fieldMap['Riesgo de inundación']], label: fieldMap['Riesgo de inundación'] };
      else if (pendingFields.has('Riesgo de inundación'))
        inundacion = { pending: true };

      if (fieldMap['Ocupación de cauce'] && CAUCE_MAP[fieldMap['Ocupación de cauce']] != null)
        cauce = { score: CAUCE_MAP[fieldMap['Ocupación de cauce']], label: fieldMap['Ocupación de cauce'] };
      else if (pendingFields.has('Ocupación de cauce'))
        cauce = { pending: true };

      if (fieldMap['Servidumbre'] && SERVIDUMBRE_MAP[fieldMap['Servidumbre']] != null)
        servidumbre = { score: SERVIDUMBRE_MAP[fieldMap['Servidumbre']], label: fieldMap['Servidumbre'] };
      else if (pendingFields.has('Servidumbre'))
        servidumbre = { pending: true };

      // Si no se resolvió desde validation_field, buscar en easements_easement
      if (!servidumbre) {
        const { rows: easeRows } = await main.query(`
          SELECT type FROM easements_easement
          WHERE terrain_id = $1 AND character = 'electrical'
          ORDER BY id DESC LIMIT 1
        `, [row.terrain_id]);
        if (easeRows.length > 0) {
          const mapped = EASEMENT_TYPE_MAP[easeRows[0].type];
          if (mapped) servidumbre = mapped;
        }
      }

      // Si cualquier proyecto del terreno tiene tracker (1P/2P), ese valor tiene prioridad sobre Mesa fija
      if (fieldMap['Tipo de arreglo'] !== '1P' && fieldMap['Tipo de arreglo'] !== '2P') {
        const { rows: trackerRows } = await main.query(`
          SELECT value FROM validation_field
          WHERE (project_id IN (SELECT id FROM minifarm_project WHERE terrain_id = $1) OR terrain_id = $1)
            AND name = 'Tipo de arreglo'
            AND value IN ('1P', '2P')
            AND value IS NOT NULL
          ORDER BY id DESC LIMIT 1
        `, [row.terrain_id]);
        if (trackerRows.length > 0) fieldMap['Tipo de arreglo'] = trackerRows[0].value;
      }

      if (fieldMap['Tipo de arreglo'] && ESTRUCTURA_MAP[fieldMap['Tipo de arreglo']] != null)
        estructura = { score: ESTRUCTURA_MAP[fieldMap['Tipo de arreglo']], label: fieldMap['Tipo de arreglo'] };
      else if (pendingFields.has('Tipo de arreglo'))
        estructura = { pending: true };

      if (fieldMap['Cambio en la cobertura vegetal'] && COBERTURA_MAP[fieldMap['Cambio en la cobertura vegetal']] != null)
        cobertura = { score: COBERTURA_MAP[fieldMap['Cambio en la cobertura vegetal']], label: fieldMap['Cambio en la cobertura vegetal'] };
      else if (pendingFields.has('Cambio en la cobertura vegetal'))
        cobertura = { pending: true };

      // Forestal: 0 árboles → Exonerado (1), con árboles → score según CAR
      // Capacidad SE — desde Google Sheets (Cantidad de minigranjas)
      try {
        const sheetRows = await fetchCapacidadSheet();
        // Busca la última fila que coincide con el terreno y tiene Cantidad de minigranjas válida
        const matches = sheetRows.filter(r => {
          const t = (r['Terreno'] || '').trim();
          return t.toUpperCase() === code || t.includes(`/lands/${row.terrain_id}/`);
        });
        for (let i = matches.length - 1; i >= 0; i--) {
          const qty = parseInt(matches[i]['Cantidad de minigranjas'], 10);
          if (!isNaN(qty)) { demanda = { value: qty }; break; }
        }
      } catch (_) {
        // Google Sheets no disponible — continúa sin este dato
      }

      const licForestal = fieldMap['Licencia de aprovechamiento forestal'];
      if (licForestal != null) {
        if (licForestal === 'Exonerado') {
          forestal = { score: '1', label: 'Exonerado' };
        } else {
          const carVal = (fieldMap['CAR'] || '').trim();
          const carScore = CAR_MAP[carVal] || '0.1';
          const carLabel = carVal || 'Otras corporaciones';
          forestal = { score: carScore, label: carLabel };
        }
      } else if (pendingFields.has('Licencia de aprovechamiento forestal')) {
        forestal = { pending: true };
      }

      // Coexistencias: ANH y ANM
      // Los valores pueden ser textos largos que comienzan con "se registra" o "no se registra"
      const normCoex = v => (v || '').toLowerCase().trim();
      const anh = normCoex(fieldMap['ANH']);
      const anm = normCoex(fieldMap['ANM']);
      if (anh.startsWith('se registra') || anm.startsWith('se registra')) {
        coexistencias = { score: '0', label: 'Tiene' };
      } else if (anh.startsWith('no se registra') || anm.startsWith('no se registra')) {
        coexistencias = { score: '1', label: 'No tiene' };
      } else if (pendingFields.has('ANH') || pendingFields.has('ANM')) {
        coexistencias = { pending: true };
      }
    }

    // Cluster: proyectos vivos del terreno (excluye dead, paused, uci)
    let cluster = null;
    if (row.terrain_id) {
      const { rows: clusterRows } = await main.query(`
        SELECT COUNT(*) as total
        FROM minifarm_project
        WHERE terrain_id = $1
          AND stage NOT IN ('dead', 'paused', 'uci')
      `, [row.terrain_id]);
      const n = parseInt(clusterRows[0].total);
      if      (n > 2)  cluster = { score: '1',   label: `${n} proyectos` };
      else if (n === 2) cluster = { score: '0.7', label: '2 proyectos' };
      else if (n === 1) cluster = { score: '0',   label: '1 proyecto' };
    }

    // Tensión desde requestsdb
    let tension = null;
    if (row.terrain_id && process.env.DB2_NAME) {
      const reqs = makeClient(process.env.DB2_NAME);
      try {
        await reqs.connect();

        if (row.project_id) {
          const { rows: tRows } = await reqs.query(`
            SELECT tension_level FROM supplies_supplyrequest
            WHERE project = $1 AND tension_level IS NOT NULL
            ORDER BY id DESC LIMIT 1
          `, [row.project_id]);
          if (tRows.length > 0) tension = mapTension(tRows[0].tension_level);

        }

      } catch (_) {
        // requestsdb no disponible — continúa sin estos datos
      } finally {
        await reqs.end().catch(() => {});
      }
    }

    return res.status(200).json({
      codigo:                row.codigo,
      municipio,
      produccion_especifica: row.produccion_especifica ?? null,
      distancia_via:         row.distancia_via         ?? null,
      distancia_red:         row.distancia_red         ?? null,
      operador:     orKey ? (OR_MAP[orKey]           || { score: '0.1', label: orKey.toUpperCase() }) : null,
      zona_vecinos: orKey ? (ZONA_VECINOS_MAP[orKey] || { score: '0.5', label: orKey.toUpperCase() }) : null,
      tension,
      adecuacion,
      inundacion,
      cauce,
      coexistencias,
      servidumbre,
      estructura,
      forestal,
      demanda,
      cobertura,
      cluster,
    });

  } catch (err) {
    console.error('DB error:', err.message);
    return res.status(500).json({ error: 'Error de BD: ' + err.message });
  } finally {
    await main.end().catch(() => {});
  }
};
