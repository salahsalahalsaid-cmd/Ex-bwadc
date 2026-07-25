/**
 * src/db.js
 * الاتصال بقاعدة بيانات PostgreSQL باستخدام مكتبة pg (connection pool).
 * القيم بتتقرا تلقائيًا من متغيرات البيئة: PGHOST, PGPORT, PGDATABASE,
 * PGUSER, PGPASSWORD (موجودين في ملف .env).
 */

const { Pool } = require('pg');

const pool = new Pool({
  max: 10, // أقصى عدد اتصالات متزامنة
  idleTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('❌ خطأ غير متوقع في اتصال قاعدة البيانات:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
