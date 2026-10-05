/**
 * Sistema de Tickets Automotriz — Chevrolet Chilpancingo
 * Servidor Backend: Node.js + Express + SQLite3
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'sistema_tickets.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar Base de Datos SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error al conectar con SQLite:', err.message);
  } else {
    console.log('✅ Conectado a la base de datos SQLite:', DB_PATH);
    initDatabase();
  }
});

// Creación de Tablas
function initDatabase() {
  db.serialize(() => {
    // 1. Tabla de tickets activos (fila de espera y en atención)
    db.run(`
      CREATE TABLE IF NOT EXISTS tickets_activos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aQueViene TEXT,
        modelo TEXT NOT NULL,
        anio INTEGER NOT NULL,
        placa TEXT NOT NULL,
        vin TEXT NOT NULL,
        kilometraje INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        telefono TEXT NOT NULL,
        email TEXT,
        timestamp INTEGER NOT NULL,
        asesor_asignado TEXT,
        estado TEXT DEFAULT 'espera',
        hora_atencion INTEGER
      )
    `, (err) => {
      if (err) console.error('Error al crear tabla tickets_activos:', err.message);
      else console.log('📁 Tabla tickets_activos lista.');
    });

    // 2. Tabla de historial de atención (servicios terminados)
    db.run(`
      CREATE TABLE IF NOT EXISTS historial_atencion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_fila_original INTEGER,
        numero_orden TEXT NOT NULL,
        placa TEXT NOT NULL,
        vin TEXT,
        modelo TEXT,
        anio INTEGER,
        kilometraje INTEGER,
        nombre TEXT,
        telefono TEXT,
        email TEXT,
        aQueViene TEXT,
        hora_llegada INTEGER,
        asesor_asignado TEXT,
        hora_terminado INTEGER NOT NULL
      )
    `, (err) => {
      if (err) console.error('Error al crear tabla historial_atencion:', err.message);
      else console.log('📁 Tabla historial_atencion lista.');
    });
  });
}

// ════════════════════════════════════════
// 📡 RUTAS DE LA API
// ════════════════════════════════════════

// 1. Obtener todos los tickets activos
app.get('/api/tickets', (req, res) => {
  db.all('SELECT * FROM tickets_activos ORDER BY timestamp ASC', [], (err, rows) => {
    if (err) {
      console.error('Error al obtener tickets:', err.message);
      return res.status(500).json({ error: 'Error al consultar tickets activos.' });
    }
    res.json(rows);
  });
});

// 2. Crear nuevo ticket (Recepción)
app.post('/api/tickets', (req, res) => {
  const {
    aQueViene,
    modelo,
    anio,
    placa,
    vin,
    kilometraje,
    nombre,
    telefono,
    email
  } = req.body;

  // Validación de obligatorios
  if (!modelo || !anio || !placa || !vin || kilometraje === undefined || !nombre || !telefono) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
  }

  // Validación estricta de VIN: exactamente 8 o 17 caracteres
  const vinUpper = String(vin).trim().toUpperCase();
  if (vinUpper.length !== 8 && vinUpper.length !== 17) {
    return res.status(400).json({
      error: `El Número de Serie (VIN) debe tener exactamente 8 o 17 caracteres. (Recibidos: ${vinUpper.length})`
    });
  }

  const query = `
    INSERT INTO tickets_activos (
      aQueViene, modelo, anio, placa, vin, kilometraje,
      nombre, telefono, email, timestamp, asesor_asignado, estado, hora_atencion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'espera', NULL)
  `;

  const values = [
    aQueViene || '—',
    modelo.trim(),
    parseInt(anio, 10),
    placa.trim().toUpperCase(),
    vinUpper,
    parseInt(kilometraje, 10),
    nombre.trim(),
    String(telefono).trim(),
    email ? email.trim() : '',
    Date.now()
  ];

  db.run(query, values, function (err) {
    if (err) {
      console.error('Error al insertar ticket:', err.message);
      return res.status(500).json({ error: 'Error al registrar el vehículo en la base de datos.' });
    }

    res.status(201).json({
      success: true,
      id: this.lastID,
      message: 'Vehículo registrado exitosamente en el sistema de tickets.'
    });
  });
});

// 3. Atender cliente (Asignar asesor a ticket activo)
app.put('/api/tickets/:id/atender', (req, res) => {
  const { id } = req.params;
  const { asesor_asignado } = req.body;

  if (!asesor_asignado) {
    return res.status(400).json({ error: 'Se requiere el nombre del asesor.' });
  }

  const query = `
    UPDATE tickets_activos
    SET asesor_asignado = ?, estado = 'en_atencion', hora_atencion = ?
    WHERE id = ?
  `;

  const values = [asesor_asignado.trim(), Date.now(), id];

  db.run(query, values, function (err) {
    if (err) {
      console.error('Error al actualizar asesor:', err.message);
      return res.status(500).json({ error: 'Error al asignar asesor al ticket.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    res.json({ success: true, message: 'Ticket asignado exitosamente.' });
  });
});

// 4. Cerrar servicio y guardar en historial con Número de Orden (5 dígitos obligatorios)
app.post('/api/tickets/cerrar', (req, res) => {
  const { id, numero_orden } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de ticket requerido.' });
  }

  const ordenStr = String(numero_orden || '').trim();

  // Validación estricta: exactamente 5 dígitos numéricos
  if (!/^\d{5}$/.test(ordenStr)) {
    return res.status(400).json({
      error: 'El Número de Orden es obligatorio y debe tener exactamente 5 dígitos numéricos (ej. 12345).'
    });
  }

  // Buscar el ticket activo
  db.get('SELECT * FROM tickets_activos WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      console.error('Error al buscar ticket:', err.message);
      return res.status(500).json({ error: 'Error al buscar el ticket.' });
    }

    if (!ticket) {
      return res.status(404).json({ error: 'El ticket especificado no existe o ya fue cerrado.' });
    }

    // Insertar en historial_atencion
    const insertHistoryQuery = `
      INSERT INTO historial_atencion (
        id_fila_original, numero_orden, placa, vin, modelo, anio,
        kilometraje, nombre, telefono, email, aQueViene,
        hora_llegada, asesor_asignado, hora_terminado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const historyValues = [
      ticket.id,
      ordenStr,
      ticket.placa,
      ticket.vin || '',
      ticket.modelo,
      ticket.anio,
      ticket.kilometraje,
      ticket.nombre,
      ticket.telefono,
      ticket.email || '',
      ticket.aQueViene || '',
      ticket.timestamp,
      ticket.asesor_asignado || 'No asignado',
      Date.now()
    ];

    db.run(insertHistoryQuery, historyValues, function (insertErr) {
      if (insertErr) {
        console.error('Error al registrar en historial:', insertErr.message);
        return res.status(500).json({ error: 'Error al registrar en el historial.' });
      }

      // Eliminar el ticket de tickets_activos
      db.run('DELETE FROM tickets_activos WHERE id = ?', [id], (deleteErr) => {
        if (deleteErr) {
          console.error('Error al eliminar ticket activo:', deleteErr.message);
          return res.status(500).json({ error: 'Error al remover el ticket de la fila activa.' });
        }

        res.json({
          success: true,
          message: 'Servicio finalizado y archivado exitosamente en el historial.',
          historialId: this.lastID
        });
      });
    });
  });
});

// 5. Consultar Historial General
app.get('/api/historial', (req, res) => {
  db.all('SELECT * FROM historial_atencion ORDER BY hora_terminado DESC', [], (err, rows) => {
    if (err) {
      console.error('Error al consultar historial:', err.message);
      return res.status(500).json({ error: 'Error al consultar historial.' });
    }
    res.json(rows);
  });
});

// Rutas amigables de interfaz
app.get('/asesores', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'asesores.html'));
});

app.get('/recepcion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Sistema de Tickets Automotriz`);
  console.log(`🏢 Chevrolet Chilpancingo - General Motors`);
  console.log(`🌐 Servidor en ejecución: http://localhost:${PORT}`);
  console.log(`📋 Recepción: http://localhost:${PORT}/index.html`);
  console.log(`👨‍💼 Asesores:  http://localhost:${PORT}/asesores.html`);
  console.log(`====================================================`);
});
