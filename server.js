// server.js - Backend API para Railway/Render
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware para prevenir caché en todas las respuestas
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static('.', {
  etag: false,
  maxAge: 0
}));

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexiones
const pool = mysql.createPool(dbConfig);

// Endpoint principal para obtener estadísticas
app.get('/api/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Query para total de inscritos
    const [inscritosResult] = await connection.query(
      'SELECT COUNT(*) as total FROM inscripcion_simulacros'
    );
    
    // Query para total de pagados (pagos entre 27 nov y 13 dic con monto entre 14 y 18 soles)
    const [pagadosResult] = await connection.query(
      `SELECT COUNT(*) as total 
       FROM banco_pagos
       WHERE fch_pag BETWEEN '2025-11-27' AND '2025-12-13'
         AND imp_pag > 14 
         AND imp_pag <= 18`
    );
    
    connection.release();
    
    const stats = {
      totalInscritos: inscritosResult[0].total,
      totalPagados: pagadosResult[0].total,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).json({ 
      error: 'Error al obtener datos',
      message: error.message 
    });
  }
});

// Endpoint para inscritos por área
app.get('/api/inscritos-por-area', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(`
      SELECT 
        a.denominacion as area,
        COUNT(DISTINCT ise.nro_documento) as total_inscritos
      FROM inscripcion_simulacros ise
      INNER JOIN estudiantes e ON ise.nro_documento = e.nro_documento
      INNER JOIN inscripciones i ON e.id = i.estudiantes_id
      INNER JOIN areas a ON i.areas_id = a.id
      WHERE i.periodos_id = 1
      GROUP BY a.id, a.denominacion
      ORDER BY a.denominacion
    `);
    
    connection.release();
    
    res.json({
      areas: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en la consulta de áreas:', error);
    res.status(500).json({ 
      error: 'Error al obtener datos por área',
      message: error.message 
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});