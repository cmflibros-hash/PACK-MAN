const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── MySQL Connection Pool ──
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'packman',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// ── Helpers ──
async function all(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (e) { console.error('SQL:', e.message); return []; }
}

async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function ensureColumn(tableName, columnName, definitionSql) {
  const col = await one(
    `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  if (!col) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
  }
}

async function ensureSchema() {
  await run(`CREATE TABLE IF NOT EXISTS cotizaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    cliente_id INT NOT NULL,
    atencion_a VARCHAR(150) NULL,
    validez_dias INT NOT NULL DEFAULT 15,
    estado VARCHAR(40) NOT NULL DEFAULT 'emitida',
    observaciones TEXT NULL,
    condiciones TEXT NULL,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    iva DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);

  await run(`CREATE TABLE IF NOT EXISTS cotizacion_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cotizacion_id INT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'manual',
    inventario_id INT NULL,
    descripcion VARCHAR(255) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(14,2) NOT NULL DEFAULT 0,
    descuento_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
    total_linea DECIMAL(14,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);

  await run(`CREATE TABLE IF NOT EXISTS modelos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    marca VARCHAR(120),
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  await ensureColumn('maquinas', 'modelo_id', 'INT NULL');

  await ensureColumn('equipos', 'modelo_id', 'INT NULL');

  await run(`CREATE TABLE IF NOT EXISTS componentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await run(`CREATE TABLE IF NOT EXISTS componente_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    componente_id INT NOT NULL,
    repuesto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    FOREIGN KEY (componente_id) REFERENCES componentes(id) ON DELETE CASCADE,
    FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await ensureColumn('reportes', 'cliente_id', 'INT NULL');
  await ensureColumn('reportes', 'motivo', 'VARCHAR(255) NULL');
  await ensureColumn('reportes', 'direccion', 'VARCHAR(255) NULL');
  await ensureColumn('reportes', 'hora_llegada', 'TIME NULL');
  await ensureColumn('reportes', 'hora_salida', 'TIME NULL');
  await ensureColumn('reportes', 'observaciones', 'TEXT NULL');
  await ensureColumn('reportes', 'nombre_cliente_terreno', 'VARCHAR(150) NULL');
  await ensureColumn('reportes', 'rut_cliente_terreno', 'VARCHAR(40) NULL');
  await ensureColumn('reportes', 'cargo_cliente_terreno', 'VARCHAR(120) NULL');
  await ensureColumn('reportes', 'firma_cliente_terreno', 'VARCHAR(150) NULL');
  await ensureColumn('reportes', 'firma_cliente_imagen', 'LONGTEXT NULL');
  await ensureColumn('reportes', 'nombre_tecnico_terreno', 'VARCHAR(150) NULL');
  await ensureColumn('reportes', 'rut_tecnico_terreno', 'VARCHAR(40) NULL');
  await ensureColumn('reportes', 'cargo_tecnico_terreno', 'VARCHAR(120) NULL');
  await ensureColumn('reportes', 'firma_tecnico_terreno', 'VARCHAR(150) NULL');
  await ensureColumn('reportes', 'firma_tecnico_imagen', 'LONGTEXT NULL');

  await run(`CREATE TABLE IF NOT EXISTS reporte_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporte_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    descripcion VARCHAR(255) NOT NULL,
    marcado TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await ensureColumn('equipos', 'orden_revision', 'INT NOT NULL DEFAULT 999');

  await ensureColumn('informes', 'cliente_id', 'INT NULL');
  await ensureColumn('informes', 'maquina_id', 'INT NULL');
  await ensureColumn('informes', 'modelo_id', 'INT NULL');
  await ensureColumn('informes', 'tecnico_id', 'INT NULL');
  await ensureColumn('informes', 'fecha_revision', 'DATE NULL');
  await ensureColumn('informes', 'observaciones_generales', 'TEXT NULL');

  await run(`CREATE TABLE IF NOT EXISTS informe_componentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    informe_id INT NOT NULL,
    equipo_id INT NOT NULL,
    componente_id INT NOT NULL,
    revisado TINYINT(1) NOT NULL DEFAULT 0,
    detalle_revision TEXT NULL,
    evidencia_foto LONGTEXT NULL,
    necesita_cambio_repuesto TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (informe_id) REFERENCES informes(id) ON DELETE CASCADE,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (componente_id) REFERENCES componentes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await run(`CREATE TABLE IF NOT EXISTS informe_componente_evidencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    informe_componente_id INT NOT NULL,
    imagen LONGTEXT NOT NULL,
    orden INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (informe_componente_id) REFERENCES informe_componentes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await ensureColumn('cubicacion_items', 'equipo_id', 'INT NULL');
  await ensureColumn('cubicacion_items', 'componente_id', 'INT NULL');
  await ensureColumn('cubicacion_items', 'cantidad_general', 'INT NULL');
}

// ══════════════ API ROUTES ══════════════

// Dashboard
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = {
      clientes: (await one('SELECT COUNT(*) as v FROM clientes')).v,
      maquinas: (await one('SELECT COUNT(*) as v FROM maquinas')).v,
      reportesPendientes: (await one("SELECT COUNT(*) as v FROM reportes WHERE estado IN ('pendiente','en proceso')")).v,
      stockBajo: (await one('SELECT COUNT(*) as v FROM inventario WHERE stock <= stock_minimo')).v,
      informes: (await one('SELECT COUNT(*) as v FROM informes')).v,
      cubicaciones: (await one('SELECT COUNT(*) as v FROM cubicaciones')).v,
    };
    const ultimosReportes = await all(`SELECT r.*, t.nombre as tecnico_nombre, m.nombre as maquina_nombre, m.modelo as maquina_modelo,
      COALESCE(c2.nombre, c.nombre) as cliente_nombre
      FROM reportes r LEFT JOIN tecnicos t ON r.tecnico_id=t.id
      LEFT JOIN maquinas m ON r.maquina_id=m.id
      LEFT JOIN clientes c ON m.cliente_id=c.id
      LEFT JOIN clientes c2 ON r.cliente_id=c2.id
      ORDER BY r.fecha DESC LIMIT 5`);

    const reportesPorEstado = await all(`SELECT COALESCE(estado, 'sin estado') as estado, COUNT(*) as total
      FROM reportes GROUP BY COALESCE(estado, 'sin estado') ORDER BY total DESC`);

    const reportesPorPrioridad = await all(`SELECT COALESCE(prioridad, 'sin prioridad') as prioridad, COUNT(*) as total
      FROM reportes GROUP BY COALESCE(prioridad, 'sin prioridad') ORDER BY total DESC`);

    const reportesMensuales = await all(`SELECT DATE_FORMAT(fecha, '%Y-%m') as periodo, COUNT(*) as total
      FROM reportes
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
      GROUP BY DATE_FORMAT(fecha, '%Y-%m')
      ORDER BY periodo ASC`);

    const topClientesActividad = await all(`SELECT
      c.id,
      c.nombre,
      (SELECT COUNT(*) FROM reportes r WHERE COALESCE(r.cliente_id, (SELECT m2.cliente_id FROM maquinas m2 WHERE m2.id=r.maquina_id)) = c.id) as hes,
      (SELECT COUNT(*) FROM informes inf WHERE inf.cliente_id=c.id) as informes,
      (SELECT COUNT(*) FROM cubicaciones cub JOIN informes inf2 ON cub.informe_id=inf2.id WHERE inf2.cliente_id=c.id) as cubicaciones
      FROM clientes c
      ORDER BY (hes + informes + cubicaciones) DESC, c.nombre ASC
      LIMIT 6`);

    const tecnicoProductividad = await all(`SELECT
      t.id,
      t.nombre,
      (SELECT COUNT(*) FROM reportes r WHERE r.tecnico_id=t.id AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as hes_30d,
      (SELECT COUNT(*) FROM informes i WHERE i.tecnico_id=t.id AND COALESCE(i.fecha_revision, i.fecha_emision) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as informes_30d
      FROM tecnicos t
      ORDER BY (hes_30d + informes_30d) DESC, t.nombre ASC
      LIMIT 8`);

    const cubicacionesRecientes = await all(`SELECT
      c.id,
      c.titulo,
      c.fecha,
      c.estado,
      c.informe_id,
      inf.titulo as informe_titulo,
      cli.nombre as cliente_nombre
      FROM cubicaciones c
      LEFT JOIN informes inf ON c.informe_id=inf.id
      LEFT JOIN clientes cli ON inf.cliente_id=cli.id
      ORDER BY c.fecha DESC, c.id DESC
      LIMIT 8`);

    const repuestosDemanda = await all(`SELECT
      r.codigo,
      r.nombre,
      SUM(ci.cantidad_general) as total_general
      FROM cubicacion_items ci
      LEFT JOIN repuestos r ON ci.repuesto_id=r.id
      GROUP BY r.codigo, r.nombre
      ORDER BY total_general DESC
      LIMIT 8`);

    const embudo = {
      hes_total: (await one('SELECT COUNT(*) as v FROM reportes')).v,
      informes_total: (await one('SELECT COUNT(*) as v FROM informes')).v,
      cubicaciones_total: (await one('SELECT COUNT(*) as v FROM cubicaciones')).v,
      hes_pendientes: stats.reportesPendientes
    };

    const stockBajoItems = await all(`SELECT i.*, r.codigo, r.nombre FROM inventario i
      LEFT JOIN repuestos r ON i.repuesto_id=r.id WHERE i.stock <= i.stock_minimo`);

    res.json({
      stats,
      ultimosReportes,
      stockBajoItems,
      reportesPorEstado,
      reportesPorPrioridad,
      reportesMensuales,
      topClientesActividad,
      tecnicoProductividad,
      cubicacionesRecientes,
      repuestosDemanda,
      embudo
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await all('SELECT * FROM clientes ORDER BY nombre');
    for (const c of clientes) {
      c.totalMaquinas = (await one('SELECT COUNT(*) as v FROM maquinas WHERE cliente_id=?', [c.id])).v;
    }
    res.json(clientes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/clientes', async (req, res) => {
  const { nombre, rut, direccion, ciudad, telefono, email, contacto_principal } = req.body;
  const result = await run('INSERT INTO clientes (nombre,rut,direccion,ciudad,telefono,email,contacto_principal) VALUES (?,?,?,?,?,?,?)',
    [nombre, rut, direccion, ciudad, telefono, email, contacto_principal]);
  res.json({ success: true, id: result.insertId });
});
app.put('/api/clientes/:id', async (req, res) => {
  const { nombre, rut, direccion, ciudad, telefono, email, contacto_principal } = req.body;
  await run('UPDATE clientes SET nombre=?,rut=?,direccion=?,ciudad=?,telefono=?,email=?,contacto_principal=? WHERE id=?',
    [nombre, rut, direccion, ciudad, telefono, email, contacto_principal, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/clientes/:id', async (req, res) => {
  await run('DELETE FROM clientes WHERE id=?', [req.params.id]);
  res.json({ success: true });
});
app.get('/api/clientes/:id/trazabilidad', async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    if (!clienteId) return res.status(400).json({ error: 'Cliente inválido' });

    const hes = await all(`SELECT r.id, r.fecha, r.motivo, r.estado,
      COALESCE(m.nombre, '-') as maquina_nombre
      FROM reportes r
      LEFT JOIN maquinas m ON r.maquina_id=m.id
      WHERE COALESCE(r.cliente_id, m.cliente_id)=?
      ORDER BY r.fecha DESC, r.id DESC`, [clienteId]);

    const informes = await all(`SELECT inf.id, inf.titulo, inf.fecha_revision, inf.fecha_emision, inf.estado,
      m.nombre as maquina_nombre, COALESCE(mo.nombre, m.modelo) as modelo_nombre,
      cub.id as cubicacion_id
      FROM informes inf
      LEFT JOIN maquinas m ON inf.maquina_id=m.id
      LEFT JOIN modelos mo ON inf.modelo_id=mo.id
      LEFT JOIN cubicaciones cub ON cub.informe_id=inf.id
      WHERE inf.cliente_id=?
      ORDER BY COALESCE(inf.fecha_revision, inf.fecha_emision) DESC, inf.id DESC`, [clienteId]);

    const cubicaciones = await all(`SELECT c.id, c.titulo, c.fecha, c.estado, c.informe_id,
      inf.titulo as informe_titulo,
      m.nombre as maquina_nombre, COALESCE(mo.nombre, m.modelo) as modelo_nombre
      FROM cubicaciones c
      JOIN informes inf ON c.informe_id=inf.id
      LEFT JOIN maquinas m ON inf.maquina_id=m.id
      LEFT JOIN modelos mo ON inf.modelo_id=mo.id
      WHERE inf.cliente_id=?
      ORDER BY c.fecha DESC, c.id DESC`, [clienteId]);

    res.json({ hes, informes, cubicaciones });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Máquinas
app.get('/api/maquinas', async (req, res) => {
  let sql = `SELECT m.*, c.nombre as cliente_nombre,
    COALESCE(mo.nombre, m.modelo) as modelo_nombre
    FROM maquinas m
    LEFT JOIN clientes c ON m.cliente_id=c.id
    LEFT JOIN modelos mo ON m.modelo_id=mo.id`;
  const params = [];
  if (req.query.cliente_id) { sql += ' WHERE m.cliente_id=?'; params.push(req.query.cliente_id); }
  res.json(await all(sql + ' ORDER BY c.nombre, modelo_nombre, m.serie', params));
});
app.post('/api/maquinas', async (req, res) => {
  const { cliente_id, modelo_id, serie, ubicacion, fecha_instalacion, estado } = req.body;
  const modelo = modelo_id ? await one('SELECT nombre FROM modelos WHERE id=?', [modelo_id]) : null;
  const nombrePin = `PIN-${serie || Date.now()}`;
  await run('INSERT INTO maquinas (cliente_id,modelo_id,nombre,modelo,serie,ubicacion,fecha_instalacion,estado) VALUES (?,?,?,?,?,?,?,?)',
    [cliente_id, modelo_id || null, nombrePin, modelo?.nombre || '', serie || '', ubicacion || '', fecha_instalacion || null, estado || 'operativa']);
  res.json({ success: true });
});
app.put('/api/maquinas/:id', async (req, res) => {
  const current = await one('SELECT * FROM maquinas WHERE id=?', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Máquina no encontrada' });

  const cliente_id = req.body.cliente_id ?? current.cliente_id;
  const modelo_id = req.body.modelo_id ?? current.modelo_id;
  const serie = req.body.serie ?? current.serie;
  const ubicacion = req.body.ubicacion ?? current.ubicacion;
  const fecha_instalacion = req.body.fecha_instalacion ?? current.fecha_instalacion;
  const estado = req.body.estado ?? current.estado;

  const modelo = modelo_id ? await one('SELECT nombre FROM modelos WHERE id=?', [modelo_id]) : null;
  const nombrePin = `PIN-${serie || current.serie || current.id}`;

  await run('UPDATE maquinas SET cliente_id=?,modelo_id=?,nombre=?,modelo=?,serie=?,ubicacion=?,fecha_instalacion=?,estado=? WHERE id=?',
    [cliente_id, modelo_id || null, nombrePin, modelo?.nombre || current.modelo || '', serie || '', ubicacion || '', fecha_instalacion || null, estado, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/maquinas/:id', async (req, res) => {
  await run('DELETE FROM maquinas WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// Repuestos
app.get('/api/repuestos', async (req, res) => {
  res.json(await all(`SELECT r.*, e.nombre as equipo, m.nombre as maquina
    FROM repuestos r LEFT JOIN equipos e ON r.equipo_id=e.id
    LEFT JOIN maquinas m ON e.maquina_id=m.id ORDER BY r.codigo`));
});
app.post('/api/repuestos', async (req, res) => {
  const { codigo, nombre, descripcion, precio, equipo_id, categoria } = req.body;
  await run('INSERT INTO repuestos (codigo,nombre,descripcion,precio,equipo_id,categoria) VALUES (?,?,?,?,?,?)',
    [codigo, nombre, descripcion, precio, equipo_id, categoria]);
  res.json({ success: true });
});
app.delete('/api/repuestos/:id', async (req, res) => {
  await run('DELETE FROM repuestos WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// Inventario
app.get('/api/inventario', async (req, res) => {
  res.json(await all(`SELECT i.*, r.codigo, r.nombre, r.descripcion, r.precio, r.categoria
    FROM inventario i LEFT JOIN repuestos r ON i.repuesto_id=r.id ORDER BY r.codigo`));
});
app.post('/api/inventario', async (req, res) => {
  try {
    const { codigo, nombre, descripcion, precio, categoria, stock, stock_minimo, ubicacion_bodega } = req.body;
    const repResult = await run('INSERT INTO repuestos (codigo,nombre,descripcion,precio,categoria) VALUES (?,?,?,?,?)',
      [codigo, nombre, descripcion || '', precio || 0, categoria || '']);
    const result = await run('INSERT INTO inventario (repuesto_id,stock,stock_minimo,ubicacion_bodega,ultimo_ingreso) VALUES (?,?,?,?,CURDATE())',
      [repResult.insertId, stock || 0, stock_minimo || 5, ubicacion_bodega || '']);
    res.json({ success: true, id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/inventario/:id', async (req, res) => {
  try {
    const { codigo, nombre, descripcion, precio, categoria, stock, stock_minimo, ubicacion_bodega } = req.body;
    const inv = await one('SELECT repuesto_id FROM inventario WHERE id=?', [req.params.id]);

    if (!inv) {
      return res.status(404).json({ error: 'Item de inventario no encontrado' });
    }

    await run('UPDATE repuestos SET codigo=?,nombre=?,descripcion=?,precio=?,categoria=? WHERE id=?',
      [codigo, nombre, descripcion || '', precio || 0, categoria || '', inv.repuesto_id]);
    await run('UPDATE inventario SET stock=?,stock_minimo=?,ubicacion_bodega=?,ultimo_ingreso=CURDATE() WHERE id=?',
      [stock || 0, stock_minimo || 0, ubicacion_bodega || '', req.params.id]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/inventario/:id', async (req, res) => {
  const inv = await one('SELECT repuesto_id FROM inventario WHERE id=?', [req.params.id]);
  await run('DELETE FROM inventario WHERE id=?', [req.params.id]);
  if (inv) await run('DELETE FROM repuestos WHERE id=?', [inv.repuesto_id]);
  res.json({ success: true });
});

// Cotizaciones
app.get('/api/cotizaciones', async (req, res) => {
  try {
    const rows = await all(`SELECT c.id, c.fecha, c.cliente_id, c.atencion_a, c.validez_dias, c.estado,
      c.observaciones, c.condiciones, c.subtotal, c.iva, c.total, c.created_at,
      cli.nombre AS cliente_nombre,
      (SELECT COUNT(*) FROM cotizacion_items ci WHERE ci.cotizacion_id = c.id) AS total_items
      FROM cotizaciones c
      JOIN clientes cli ON c.cliente_id = cli.id
      ORDER BY c.fecha DESC, c.id DESC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/cotizaciones/:id', async (req, res) => {
  try {
    const cotizacion = await one(`SELECT c.id, c.fecha, c.cliente_id, c.atencion_a, c.validez_dias, c.estado,
      c.observaciones, c.condiciones, c.subtotal, c.iva, c.total, c.created_at,
      cli.nombre AS cliente_nombre, cli.rut AS cliente_rut, cli.direccion AS cliente_direccion,
      cli.ciudad AS cliente_ciudad, cli.telefono AS cliente_telefono, cli.email AS cliente_email
      FROM cotizaciones c
      JOIN clientes cli ON c.cliente_id = cli.id
      WHERE c.id = ?`, [req.params.id]);

    if (!cotizacion) return res.status(404).json({ error: 'Cotizacion no encontrada' });

    const items = await all(`SELECT ci.*, r.codigo AS inventario_codigo, r.nombre AS inventario_nombre
      FROM cotizacion_items ci
      LEFT JOIN inventario i ON ci.inventario_id = i.id
      LEFT JOIN repuestos r ON i.repuesto_id = r.id
      WHERE ci.cotizacion_id = ?
      ORDER BY ci.id ASC`, [req.params.id]);

    res.json({ cotizacion, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cotizaciones', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      fecha,
      cliente_id,
      atencion_a,
      validez_dias,
      observaciones,
      condiciones,
      items = []
    } = req.body || {};

    if (!fecha || !cliente_id) {
      return res.status(400).json({ error: 'Fecha y cliente son obligatorios' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debes agregar al menos un item' });
    }

    let subtotal = 0;
    const cleanItems = items.map((it) => {
      const cantidad = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
      const precioUnitario = Number(it.precio_unitario) >= 0 ? Number(it.precio_unitario) : 0;
      const descuentoPct = Number(it.descuento_pct) >= 0 ? Number(it.descuento_pct) : 0;
      const descuentoFactor = Math.min(descuentoPct, 100) / 100;
      const base = cantidad * precioUnitario;
      const totalLinea = Number((base * (1 - descuentoFactor)).toFixed(2));
      subtotal += totalLinea;
      return {
        tipo: it.tipo === 'inventario' ? 'inventario' : 'manual',
        inventario_id: it.inventario_id ? Number(it.inventario_id) : null,
        descripcion: String(it.descripcion || '').trim(),
        cantidad,
        precio_unitario: precioUnitario,
        descuento_pct: Math.min(descuentoPct, 100),
        total_linea: totalLinea
      };
    });

    if (cleanItems.some((it) => !it.descripcion)) {
      return res.status(400).json({ error: 'Todos los items deben tener descripcion' });
    }

    const iva = Number((subtotal * 0.19).toFixed(2));
    const total = Number((subtotal + iva).toFixed(2));

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO cotizaciones
      (fecha, cliente_id, atencion_a, validez_dias, observaciones, condiciones, subtotal, iva, total)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        fecha,
        Number(cliente_id),
        atencion_a || '',
        Number(validez_dias) > 0 ? Number(validez_dias) : 15,
        observaciones || '',
        condiciones || '',
        subtotal,
        iva,
        total
      ]
    );

    for (const item of cleanItems) {
      await conn.execute(
        `INSERT INTO cotizacion_items
        (cotizacion_id, tipo, inventario_id, descripcion, cantidad, precio_unitario, descuento_pct, total_linea)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          result.insertId,
          item.tipo,
          item.inventario_id,
          item.descripcion,
          item.cantidad,
          item.precio_unitario,
          item.descuento_pct,
          item.total_linea
        ]
      );
    }

    await conn.commit();
    res.json({ success: true, id: result.insertId, subtotal, iva, total });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.patch('/api/cotizaciones/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body || {};
    const valid = ['emitida','aprobada','rechazada','vencida','facturada'];
    if (!estado || !valid.includes(estado)) return res.status(400).json({ error: 'Estado invalido' });
    await run('UPDATE cotizaciones SET estado=? WHERE id=?', [estado, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/cotizaciones/:id', async (req, res) => {
  try {
    await run('DELETE FROM cotizaciones WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Técnicos
app.get('/api/tecnicos', async (req, res) => res.json(await all('SELECT * FROM tecnicos ORDER BY nombre')));
app.post('/api/tecnicos', async (req, res) => {
  const { nombre, especialidad, telefono, email } = req.body;
  await run('INSERT INTO tecnicos (nombre,especialidad,telefono,email) VALUES (?,?,?,?)',
    [nombre, especialidad, telefono, email]);
  res.json({ success: true });
});

// Reportes
app.get('/api/reportes', async (req, res) => {
  res.json(await all(`SELECT r.*, t.nombre as tecnico_nombre, m.nombre as maquina_nombre, m.modelo as maquina_modelo,
    COALESCE(c2.nombre, c.nombre) as cliente_nombre,
    COALESCE(r.direccion, c2.direccion, c.direccion) as direccion_cliente,
    (SELECT COUNT(*) FROM reporte_items ri WHERE ri.reporte_id=r.id) as total_items
    FROM reportes r LEFT JOIN tecnicos t ON r.tecnico_id=t.id
    LEFT JOIN maquinas m ON r.maquina_id=m.id
    LEFT JOIN clientes c ON m.cliente_id=c.id
    LEFT JOIN clientes c2 ON r.cliente_id=c2.id
    ORDER BY r.fecha DESC`));
});
app.get('/api/reportes/:id', async (req, res) => {
  const reporte = await one(`SELECT r.*, t.nombre as tecnico_nombre,
    COALESCE(c2.nombre, c.nombre) as cliente_nombre,
    COALESCE(r.direccion, c2.direccion, c.direccion) as direccion_cliente
    FROM reportes r
    LEFT JOIN tecnicos t ON r.tecnico_id=t.id
    LEFT JOIN maquinas m ON r.maquina_id=m.id
    LEFT JOIN clientes c ON m.cliente_id=c.id
    LEFT JOIN clientes c2 ON r.cliente_id=c2.id
    WHERE r.id=?`, [req.params.id]);

  if (!reporte) {
    return res.status(404).json({ error: 'Reporte no encontrado' });
  }

  const items = await all('SELECT * FROM reporte_items WHERE reporte_id=? ORDER BY id ASC', [req.params.id]);
  res.json({ reporte, items });
});
app.post('/api/reportes', async (req, res) => {
  const {
    fecha,
    motivo,
    cliente_id,
    direccion,
    hora_llegada,
    hora_salida,
    tecnico_id,
    observaciones,
    nombre_cliente_terreno,
    rut_cliente_terreno,
    cargo_cliente_terreno,
    firma_cliente_terreno,
    firma_cliente_imagen,
    nombre_tecnico_terreno,
    rut_tecnico_terreno,
    cargo_tecnico_terreno,
    firma_tecnico_terreno,
    firma_tecnico_imagen,
    items = []
  } = req.body;

  if (!fecha || !motivo || !cliente_id) {
    return res.status(400).json({ error: 'Fecha, motivo y cliente son obligatorios' });
  }

  const tecnicoIdValue = tecnico_id ? Number(tecnico_id) : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.execute(`INSERT INTO reportes (
      tecnico_id, maquina_id, fecha, tipo, descripcion, hallazgos, recomendaciones, prioridad,
      cliente_id, motivo, direccion, hora_llegada, hora_salida, observaciones,
      nombre_cliente_terreno, rut_cliente_terreno, cargo_cliente_terreno, firma_cliente_terreno, firma_cliente_imagen,
      nombre_tecnico_terreno, rut_tecnico_terreno, cargo_tecnico_terreno, firma_tecnico_terreno, firma_tecnico_imagen
    ) VALUES (?, NULL, ?, 'hes', ?, ?, '', 'media', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      tecnicoIdValue,
      fecha,
      motivo,
      observaciones || '',
      cliente_id,
      motivo,
      direccion || '',
      hora_llegada || null,
      hora_salida || null,
      observaciones || '',
      nombre_cliente_terreno || '',
      rut_cliente_terreno || '',
      cargo_cliente_terreno || '',
      firma_cliente_terreno || '',
      firma_cliente_imagen || null,
      nombre_tecnico_terreno || '',
      rut_tecnico_terreno || '',
      cargo_tecnico_terreno || '',
      firma_tecnico_terreno || '',
      firma_tecnico_imagen || null
    ]);

    const reporteId = ins.insertId;
    for (const item of items) {
      const descripcion = String(item.descripcion || '').trim();
      if (!descripcion) continue;
      const cantidad = Number(item.cantidad) > 0 ? Number(item.cantidad) : 1;
      const marcado = item.marcado ? 1 : 0;
      await conn.execute(
        'INSERT INTO reporte_items (reporte_id,cantidad,descripcion,marcado) VALUES (?,?,?,?)',
        [reporteId, cantidad, descripcion, marcado]
      );
    }

    await conn.commit();
    res.json({ success: true, id: reporteId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});
app.put('/api/reportes/:id', async (req, res) => {
  const { estado } = req.body;
  await run('UPDATE reportes SET estado=? WHERE id=?', [estado, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/reportes/:id', async (req, res) => {
  try {
    const exists = await one('SELECT id FROM reportes WHERE id=?', [req.params.id]);
    if (!exists) return res.status(404).json({ error: 'Reporte no encontrado' });

    await run('DELETE FROM reportes WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Informes
app.get('/api/informes', async (req, res) => {
  const rows = await all(`SELECT inf.*, t.nombre as tecnico_nombre,
    c.nombre as cliente_nombre, temp.nombre as temporada_nombre,
    m.nombre as maquina_nombre, COALESCE(mo.nombre, m.modelo) as modelo_nombre,
    (SELECT COUNT(*) FROM informe_componentes ic WHERE ic.informe_id=inf.id) as total_componentes,
    (SELECT COUNT(*) FROM informe_componentes ic WHERE ic.informe_id=inf.id AND ic.revisado=1) as total_revisados,
    cub.id as cubicacion_id
    FROM informes inf
    LEFT JOIN clientes c ON inf.cliente_id=c.id
    LEFT JOIN tecnicos t ON inf.tecnico_id=t.id
    LEFT JOIN maquinas m ON inf.maquina_id=m.id
    LEFT JOIN modelos mo ON inf.modelo_id=mo.id
    LEFT JOIN temporadas temp ON inf.temporada_id=temp.id
    LEFT JOIN cubicaciones cub ON cub.informe_id=inf.id
    ORDER BY COALESCE(inf.fecha_revision, inf.fecha_emision) DESC, inf.id DESC`);
  res.json(rows);
});
app.get('/api/informes/:id', async (req, res) => {
  const informe = await one(`SELECT inf.*, t.nombre as tecnico_nombre,
    c.nombre as cliente_nombre, temp.nombre as temporada_nombre,
    m.nombre as maquina_nombre, COALESCE(mo.nombre, m.modelo) as modelo_nombre
    FROM informes inf
    LEFT JOIN clientes c ON inf.cliente_id=c.id
    LEFT JOIN tecnicos t ON inf.tecnico_id=t.id
    LEFT JOIN maquinas m ON inf.maquina_id=m.id
    LEFT JOIN modelos mo ON inf.modelo_id=mo.id
    LEFT JOIN temporadas temp ON inf.temporada_id=temp.id
    WHERE inf.id=?`, [req.params.id]);

  if (!informe) return res.status(404).json({ error: 'Informe no encontrado' });

  const componentes = await all(`SELECT ic.*, e.nombre as equipo_nombre, e.orden_revision,
      c.nombre as componente_nombre
    FROM informe_componentes ic
    JOIN equipos e ON ic.equipo_id=e.id
    JOIN componentes c ON ic.componente_id=c.id
    WHERE ic.informe_id=?
    ORDER BY COALESCE(e.orden_revision, 999), e.nombre, c.nombre`, [req.params.id]);

  const evidencias = await all(`SELECT id, informe_componente_id, imagen, orden
    FROM informe_componente_evidencias
    WHERE informe_componente_id IN (
      SELECT id FROM informe_componentes WHERE informe_id=?
    )
    ORDER BY informe_componente_id, orden, id`, [req.params.id]);

  const evidenciasByComp = new Map();
  for (const ev of evidencias) {
    const key = String(ev.informe_componente_id);
    if (!evidenciasByComp.has(key)) evidenciasByComp.set(key, []);
    evidenciasByComp.get(key).push(ev.imagen);
  }

  for (const c of componentes) {
    c.evidencia_fotos = evidenciasByComp.get(String(c.id)) || [];
  }

  const cubicacion = await one(`SELECT id, titulo, fecha, estado, informe_id, total
    FROM cubicaciones WHERE informe_id=? ORDER BY id DESC LIMIT 1`, [req.params.id]);

  const cubicacion_items = cubicacion ? await all(`SELECT ci.*, r.codigo, r.nombre as repuesto_nombre,
      e.nombre as equipo_nombre, c.nombre as componente_nombre
    FROM cubicacion_items ci
    LEFT JOIN repuestos r ON ci.repuesto_id=r.id
    LEFT JOIN equipos e ON ci.equipo_id=e.id
    LEFT JOIN componentes c ON ci.componente_id=c.id
    WHERE ci.cubicacion_id=?
    ORDER BY COALESCE(e.orden_revision, 999), e.nombre, c.nombre, r.nombre`, [cubicacion.id]) : [];

  res.json({ informe, componentes, cubicacion, cubicacion_items });
});
app.post('/api/informes', async (req, res) => {
  const {
    cliente_id,
    maquina_id,
    tecnico_id,
    temporada_id,
    fecha_revision,
    titulo,
    resumen,
    observaciones_generales,
    componentes = []
  } = req.body;

  if (!cliente_id || !maquina_id || !tecnico_id || !fecha_revision || !titulo) {
    return res.status(400).json({ error: 'Cliente, maquina, tecnico, fecha y titulo son obligatorios' });
  }

  const maquina = await one('SELECT id, modelo_id, modelo FROM maquinas WHERE id=?', [maquina_id]);
  if (!maquina) return res.status(404).json({ error: 'Maquina no encontrada' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [insInforme] = await conn.execute(`INSERT INTO informes
      (reporte_id, temporada_id, titulo, resumen, hallazgos_detallados, recomendaciones_detalladas, fecha_emision, estado,
       cliente_id, maquina_id, modelo_id, tecnico_id, fecha_revision, observaciones_generales)
      VALUES (NULL, ?, ?, ?, '', '', ?, 'emitido', ?, ?, ?, ?, ?, ?)`, [
      temporada_id || null,
      titulo,
      resumen || '',
      fecha_revision,
      cliente_id,
      maquina_id,
      maquina.modelo_id || null,
      tecnico_id,
      fecha_revision,
      observaciones_generales || ''
    ]);

    const informeId = insInforme.insertId;

    const repuestoRows = [];
    for (const comp of componentes) {
      const equipoId = Number(comp.equipo_id);
      const componenteId = Number(comp.componente_id);
      if (!equipoId || !componenteId) continue;

      const [insComp] = await conn.execute(`INSERT INTO informe_componentes
        (informe_id, equipo_id, componente_id, revisado, detalle_revision, evidencia_foto, necesita_cambio_repuesto)
        VALUES (?,?,?,?,?,?,?)`, [
        informeId,
        equipoId,
        componenteId,
        comp.revisado ? 1 : 0,
        comp.detalle_revision || '',
        JSON.stringify(Array.isArray(comp.evidencia_fotos)
          ? comp.evidencia_fotos.filter(Boolean)
          : (comp.evidencia_foto ? [comp.evidencia_foto] : [])),
        comp.necesita_cambio_repuesto ? 1 : 0
      ]);

      const informeComponenteId = insComp.insertId;
      const fotos = Array.isArray(comp.evidencia_fotos)
        ? comp.evidencia_fotos.filter(Boolean)
        : (comp.evidencia_foto ? [comp.evidencia_foto] : []);
      let orden = 1;
      for (const foto of fotos) {
        await conn.execute(
          'INSERT INTO informe_componente_evidencias (informe_componente_id, imagen, orden) VALUES (?,?,?)',
          [informeComponenteId, foto, orden++]
        );
      }

      if (comp.necesita_cambio_repuesto) {
        const [items] = await conn.execute(
          'SELECT repuesto_id, cantidad FROM componente_items WHERE componente_id=?',
          [componenteId]
        );
        for (const it of items) {
          repuestoRows.push({
            equipo_id: equipoId,
            componente_id: componenteId,
            repuesto_id: it.repuesto_id,
            cantidad: Number(it.cantidad) || 1
          });
        }
      }
    }

    const [insCub] = await conn.execute(`INSERT INTO cubicaciones
      (temporada_id, informe_id, titulo, fecha, estado, total)
      VALUES (?, ?, ?, ?, 'emitida', 0)`, [
      temporada_id || null,
      informeId,
      `Cubicacion ${titulo}`,
      fecha_revision,
    ]);

    const cubicacionId = insCub.insertId;
    const totals = new Map();
    for (const row of repuestoRows) {
      const key = String(row.repuesto_id);
      totals.set(key, (totals.get(key) || 0) + (row.cantidad || 0));
    }

    for (const row of repuestoRows) {
      const general = totals.get(String(row.repuesto_id)) || row.cantidad || 0;
      await conn.execute(`INSERT INTO cubicacion_items
        (cubicacion_id, repuesto_id, cantidad, precio_unitario, equipo_id, componente_id, cantidad_general)
        VALUES (?, ?, ?, 0, ?, ?, ?)`, [
        cubicacionId,
        row.repuesto_id,
        row.cantidad,
        row.equipo_id,
        row.componente_id,
        general
      ]);
    }

    await conn.commit();
    res.json({ success: true, id: informeId, cubicacion_id: cubicacionId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Temporadas
app.get('/api/temporadas', async (req, res) => {
  try {
    const temps = await all('SELECT * FROM temporadas ORDER BY fecha_inicio DESC');
    for (const t of temps) {
      t.totalReportes = (await one('SELECT COUNT(*) as v FROM reportes WHERE fecha BETWEEN ? AND ?', [t.fecha_inicio, t.fecha_fin]))?.v || 0;
      t.totalInformes = (await one('SELECT COUNT(*) as v FROM informes WHERE temporada_id=?', [t.id]))?.v || 0;
      t.totalCubicaciones = (await one('SELECT COUNT(*) as v FROM cubicaciones WHERE temporada_id=?', [t.id]))?.v || 0;
    }
    res.json(temps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/temporadas/:id/resumen', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Temporada inválida' });

    const temporada = await one('SELECT * FROM temporadas WHERE id=?', [id]);
    if (!temporada) return res.status(404).json({ error: 'Temporada no encontrada' });

    const reportes = await all(`SELECT r.id, r.fecha, r.motivo, r.estado,
      COALESCE(c2.nombre, c.nombre) as cliente_nombre,
      m.nombre as maquina_nombre,
      t.nombre as tecnico_nombre
      FROM reportes r
      LEFT JOIN tecnicos t ON r.tecnico_id=t.id
      LEFT JOIN maquinas m ON r.maquina_id=m.id
      LEFT JOIN clientes c ON m.cliente_id=c.id
      LEFT JOIN clientes c2 ON r.cliente_id=c2.id
      WHERE r.fecha BETWEEN ? AND ?
      ORDER BY r.fecha DESC, r.id DESC`, [temporada.fecha_inicio, temporada.fecha_fin]);

    const informes = await all(`SELECT inf.id, inf.titulo, inf.estado,
      COALESCE(inf.fecha_revision, inf.fecha_emision) as fecha,
      cli.nombre as cliente_nombre,
      maq.nombre as maquina_nombre,
      cub.id as cubicacion_id
      FROM informes inf
      LEFT JOIN clientes cli ON inf.cliente_id=cli.id
      LEFT JOIN maquinas maq ON inf.maquina_id=maq.id
      LEFT JOIN cubicaciones cub ON cub.informe_id=inf.id
      WHERE inf.temporada_id=?
      ORDER BY fecha DESC, inf.id DESC`, [id]);

    const cubicaciones = await all(`SELECT c.id, c.titulo, c.fecha, c.estado, c.informe_id,
      inf.titulo as informe_titulo,
      cli.nombre as cliente_nombre
      FROM cubicaciones c
      LEFT JOIN informes inf ON c.informe_id=inf.id
      LEFT JOIN clientes cli ON inf.cliente_id=cli.id
      WHERE c.temporada_id=?
      ORDER BY c.fecha DESC, c.id DESC`, [id]);

    res.json({
      temporada,
      resumen: {
        totalReportes: reportes.length,
        totalInformes: informes.length,
        totalCubicaciones: cubicaciones.length
      },
      reportes,
      informes,
      cubicaciones
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/temporadas', async (req, res) => {
  const { nombre, fecha_inicio, fecha_fin, estado, descripcion } = req.body;
  await run('INSERT INTO temporadas (nombre,fecha_inicio,fecha_fin,estado,descripcion) VALUES (?,?,?,?,?)',
    [nombre, fecha_inicio, fecha_fin, estado, descripcion]);
  res.json({ success: true });
});
app.put('/api/temporadas/:id', async (req, res) => {
  const { nombre, fecha_inicio, fecha_fin, estado, descripcion } = req.body;
  await run('UPDATE temporadas SET nombre=?,fecha_inicio=?,fecha_fin=?,estado=?,descripcion=? WHERE id=?',
    [nombre, fecha_inicio, fecha_fin, estado, descripcion || '', req.params.id]);
  res.json({ success: true });
});
app.delete('/api/temporadas/:id', async (req, res) => {
  await run('DELETE FROM temporadas WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// Cubicaciones
app.get('/api/cubicaciones', async (req, res) => {
  try {
    const cubis = await all(`SELECT c.*, inf.titulo as informe_titulo, temp.nombre as temporada_nombre,
      cli.nombre as cliente_nombre, maq.nombre as maquina_nombre, COALESCE(mo.nombre, maq.modelo) as modelo_nombre
      FROM cubicaciones c LEFT JOIN informes inf ON c.informe_id=inf.id
      LEFT JOIN clientes cli ON inf.cliente_id=cli.id
      LEFT JOIN maquinas maq ON inf.maquina_id=maq.id
      LEFT JOIN modelos mo ON inf.modelo_id=mo.id
      LEFT JOIN temporadas temp ON c.temporada_id=temp.id ORDER BY c.fecha DESC`);
    for (const c of cubis) {
      c.items = await all(`SELECT ci.*, r.codigo, r.nombre as repuesto_nombre,
        e.nombre as equipo_nombre, comp.nombre as componente_nombre
        FROM cubicacion_items ci LEFT JOIN repuestos r ON ci.repuesto_id=r.id
        LEFT JOIN equipos e ON ci.equipo_id=e.id
        LEFT JOIN componentes comp ON ci.componente_id=comp.id
        WHERE ci.cubicacion_id=?`, [c.id]);
    }
    res.json(cubis);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/cubicaciones/:id', async (req, res) => {
  const cubicacion = await one(`SELECT c.*, inf.titulo as informe_titulo, temp.nombre as temporada_nombre,
    cli.nombre as cliente_nombre, maq.nombre as maquina_nombre, COALESCE(mo.nombre, maq.modelo) as modelo_nombre
    FROM cubicaciones c LEFT JOIN informes inf ON c.informe_id=inf.id
    LEFT JOIN clientes cli ON inf.cliente_id=cli.id
    LEFT JOIN maquinas maq ON inf.maquina_id=maq.id
    LEFT JOIN modelos mo ON inf.modelo_id=mo.id
    LEFT JOIN temporadas temp ON c.temporada_id=temp.id WHERE c.id=?`, [req.params.id]);
  const items = cubicacion ? await all(`SELECT ci.*, r.codigo, r.nombre as repuesto_nombre,
    e.nombre as equipo_nombre, comp.nombre as componente_nombre
    FROM cubicacion_items ci LEFT JOIN repuestos r ON ci.repuesto_id=r.id
    LEFT JOIN equipos e ON ci.equipo_id=e.id
    LEFT JOIN componentes comp ON ci.componente_id=comp.id
    WHERE ci.cubicacion_id=?`, [req.params.id]) : [];
  res.json({ cubicacion, items });
});

// Equipos
app.get('/api/equipos', async (req, res) => {
  res.json(await all(`SELECT e.*, m.nombre as maquina, mo.nombre as modelo_nombre
    FROM equipos e
    LEFT JOIN maquinas m ON e.maquina_id=m.id
    LEFT JOIN modelos mo ON e.modelo_id=mo.id
    ORDER BY mo.nombre, m.nombre, e.nombre`));
});

// Modelos
app.get('/api/modelos', async (req, res) => {
  const modelos = await all('SELECT * FROM modelos ORDER BY nombre');
  for (const m of modelos) {
    m.totalEquipos = (await one('SELECT COUNT(*) AS v FROM equipos WHERE modelo_id=?', [m.id]))?.v || 0;
    m.totalComponentes = (await one(`SELECT COUNT(*) AS v FROM componentes c
      JOIN equipos e ON c.equipo_id=e.id WHERE e.modelo_id=?`, [m.id]))?.v || 0;
    m.totalItems = (await one(`SELECT COUNT(*) AS v FROM componente_items ci
      JOIN componentes c ON ci.componente_id=c.id
      JOIN equipos e ON c.equipo_id=e.id WHERE e.modelo_id=?`, [m.id]))?.v || 0;
  }
  res.json(modelos);
});
app.post('/api/modelos', async (req, res) => {
  const { nombre, marca, descripcion } = req.body;
  const result = await run('INSERT INTO modelos (nombre,marca,descripcion) VALUES (?,?,?)', [nombre, marca || '', descripcion || '']);
  res.json({ success: true, id: result.insertId });
});
app.put('/api/modelos/:id', async (req, res) => {
  const { nombre, marca, descripcion } = req.body;
  await run('UPDATE modelos SET nombre=?,marca=?,descripcion=? WHERE id=?', [nombre, marca || '', descripcion || '', req.params.id]);
  res.json({ success: true });
});
app.delete('/api/modelos/:id', async (req, res) => {
  await run('DELETE FROM modelos WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/modelos/:id/equipos', async (req, res) => {
  res.json(await all('SELECT * FROM equipos WHERE modelo_id=? ORDER BY COALESCE(orden_revision,999), nombre', [req.params.id]));
});
app.put('/api/modelos/:id/equipos/orden', async (req, res) => {
  const { ordenes = [] } = req.body;
  for (const o of ordenes) {
    if (!o?.equipo_id) continue;
    await run('UPDATE equipos SET orden_revision=? WHERE id=? AND modelo_id=?', [Number(o.orden) || 999, o.equipo_id, req.params.id]);
  }
  res.json({ success: true });
});
app.post('/api/modelos/:id/equipos', async (req, res) => {
  const { nombre, modelo, descripcion } = req.body;
  const result = await run('INSERT INTO equipos (modelo_id,nombre,modelo,descripcion) VALUES (?,?,?,?)', [req.params.id, nombre, modelo || '', descripcion || '']);
  res.json({ success: true, id: result.insertId });
});
app.put('/api/equipos/:id', async (req, res) => {
  const { nombre, modelo, descripcion } = req.body;
  await run('UPDATE equipos SET nombre=?,modelo=?,descripcion=? WHERE id=?', [nombre, modelo || '', descripcion || '', req.params.id]);
  res.json({ success: true });
});
app.delete('/api/equipos/:id', async (req, res) => {
  await run('DELETE FROM equipos WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/equipos/:id/componentes', async (req, res) => {
  res.json(await all('SELECT * FROM componentes WHERE equipo_id=? ORDER BY nombre', [req.params.id]));
});
app.post('/api/equipos/:id/componentes', async (req, res) => {
  const { nombre, descripcion } = req.body;
  const result = await run('INSERT INTO componentes (equipo_id,nombre,descripcion) VALUES (?,?,?)', [req.params.id, nombre, descripcion || '']);
  res.json({ success: true, id: result.insertId });
});
app.put('/api/componentes/:id', async (req, res) => {
  const { nombre, descripcion } = req.body;
  await run('UPDATE componentes SET nombre=?,descripcion=? WHERE id=?', [nombre, descripcion || '', req.params.id]);
  res.json({ success: true });
});
app.delete('/api/componentes/:id', async (req, res) => {
  await run('DELETE FROM componentes WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/componentes/:id/items', async (req, res) => {
  res.json(await all(`SELECT ci.*, r.codigo, r.nombre, r.categoria, inv.stock
    FROM componente_items ci
    JOIN repuestos r ON ci.repuesto_id=r.id
    LEFT JOIN inventario inv ON inv.repuesto_id=r.id
    WHERE ci.componente_id=?
    ORDER BY r.codigo`, [req.params.id]));
});
app.post('/api/componentes/:id/items', async (req, res) => {
  const { repuesto_id, cantidad } = req.body;
  const existing = await one('SELECT id,cantidad FROM componente_items WHERE componente_id=? AND repuesto_id=?', [req.params.id, repuesto_id]);
  if (existing) {
    await run('UPDATE componente_items SET cantidad=? WHERE id=?', [(existing.cantidad || 0) + (cantidad || 1), existing.id]);
  } else {
    await run('INSERT INTO componente_items (componente_id,repuesto_id,cantidad) VALUES (?,?,?)', [req.params.id, repuesto_id, cantidad || 1]);
  }
  res.json({ success: true });
});
app.put('/api/componente-items/:id', async (req, res) => {
  const { cantidad } = req.body;
  await run('UPDATE componente_items SET cantidad=? WHERE id=?', [cantidad || 1, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/componente-items/:id', async (req, res) => {
  await run('DELETE FROM componente_items WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/modelos/:id/repuestos', async (req, res) => {
  res.json(await all(`SELECT r.id, r.codigo, r.nombre, r.categoria,
      SUM(ci.cantidad) AS cantidad_total,
      COALESCE(inv.stock, 0) AS stock_actual
    FROM componente_items ci
    JOIN componentes c ON ci.componente_id=c.id
    JOIN equipos e ON c.equipo_id=e.id
    JOIN repuestos r ON ci.repuesto_id=r.id
    LEFT JOIN inventario inv ON inv.repuesto_id=r.id
    WHERE e.modelo_id=?
    GROUP BY r.id, r.codigo, r.nombre, r.categoria, inv.stock
    ORDER BY r.codigo`, [req.params.id]));
});

// ── Start ──
pool.getConnection()
  .then(async conn => {
    await ensureSchema();
    conn.release();
    console.log('✓ Conectado a MySQL - BD packman');
    app.listen(3001, () => console.log('✓ Servidor Packman en http://localhost:3001'));
  })
  .catch(err => {
    console.error('✗ Error conectando a MySQL:', err.message);
    process.exit(1);
  });
