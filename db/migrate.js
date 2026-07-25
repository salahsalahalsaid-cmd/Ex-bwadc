/**
 * db/migrate.js
 * ------------------------------------------------------------------
 * نظام ترقية (Migrations) بسيط لقاعدة بيانات PostgreSQL.
 *
 * الفكرة: أي تعديل على قاعدة البيانات (إضافة عمود، جدول جديد...الخ)
 * بيتكتب في ملف SQL جديد جوه مجلد db/migrations بترقيم تصاعدي، مثال:
 *   002_add_news_views_column.sql
 *   003_add_bill_lookup_table.sql
 *
 * وبعدين تشغّل: npm run migrate
 * والسكريبت ده هيطبّق بس الملفات اللي لسه ما اتنفذتش، وهيسجلها
 * في جدول schema_migrations عشان ميكررهاش تاني. ده معناه إنك تقدر
 * تعمل "أبجريد" للموقع بأمان من غير ما تفقد أي بيانات موجودة.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔄 الاتصال بقاعدة البيانات...');
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // الترتيب الأبجدي/الرقمي مهم جدًا

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅ قاعدة البيانات محدّثة بالفعل، لا يوجد ترقيات جديدة.');
      return;
    }

    for (const file of pending) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`⏳ جارٍ تطبيق: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ تم تطبيق: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ فشل تطبيق ${file}:`, err.message);
        throw err;
      }
    }

    console.log(`🎉 تم تطبيق ${pending.length} ترقية بنجاح.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('حدث خطأ أثناء الترقية:', err);
  process.exit(1);
});
