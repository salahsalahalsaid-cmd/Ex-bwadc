/**
 * db/seed.js
 * ------------------------------------------------------------------
 * يزرع بيانات مبدئية في قاعدة البيانات:
 *  - حساب مدير افتراضي (من متغيرات البيئة ADMIN_EMAIL / ADMIN_PASSWORD)
 *  - إعدادات موقع أساسية
 *  - بعض الخدمات والإحصائيات كأمثلة
 * شغّله مرة واحدة بعد إنشاء قاعدة البيانات: npm run seed
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({ ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // 1) إنشاء حساب المدير الافتراضي إن لم يكن موجودًا
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const { rows: existing } = await client.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [adminEmail]
    );
    if (existing.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await client.query(
        `INSERT INTO admin_users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, 'superadmin')`,
        ['مدير الموقع', adminEmail, hash]
      );
      console.log(`✅ تم إنشاء حساب المدير: ${adminEmail}`);
    } else {
      console.log('ℹ️ حساب المدير موجود بالفعل، تم التخطي.');
    }

    // 2) إعدادات الموقع الأساسية
    const settings = [
      ['site_name', 'شركة مياه الشرب والصرف الصحي'],
      ['hotline', '125'],
      ['phone', '045-3331308'],
      ['fax', '045-3331310'],
      ['address', 'شارع الجيش المصري بجوار جزيرة البط، دمنهور، محافظة البحيرة'],
      ['facebook_url', 'https://www.facebook.com/'],
      ['whatsapp_url', 'https://wa.me/'],
      ['about_short', 'شركة تابعة للشركة القابضة لمياه الشرب والصرف الصحي، تعمل على إدارة وتشغيل وتطوير مرافق المياه والصرف الصحي.'],
    ];
    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    console.log('✅ تم زرع إعدادات الموقع.');

    // 3) خدمات مبدئية
    const { rows: svcCount } = await client.query('SELECT COUNT(*)::int FROM services');
    if (svcCount[0].count === 0) {
      const services = [
        ['الاستعلام عن الفاتورة', 'اعرف قيمة استهلاكك الشهري بسهولة وسرعة.', 'bi-file-earmark-text', '#', 1],
        ['إرسال قراءة العداد', 'سجّل قراءة عدادك أونلاين دون الحاجة لزيارة فرع.', 'bi-speedometer2', '#', 2],
        ['شكاوى ومقترحات', 'قدّم شكواك أو اقتراحك وتابع حالته.', 'bi-chat-dots', '/complaints', 3],
        ['دليل الخدمات الجماهيرية', 'تعرّف على كل الخدمات وإجراءاتها الرسمية.', 'bi-journal-text', '#', 4],
        ['عدادات مسبقة الدفع', 'تابع رصيدك وتحكم في استهلاكك بسهولة.', 'bi-credit-card', '#', 5],
        ['الفروع', 'أقرب فرع ليك وبياناته وأرقام التواصل.', 'bi-geo-alt', '/branches', 6],
      ];
      for (const s of services) {
        await client.query(
          `INSERT INTO services (title, description, icon, link_url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          s
        );
      }
      console.log('✅ تم زرع الخدمات المبدئية.');
    }

    // 4) إحصائيات مبدئية
    const { rows: statCount } = await client.query('SELECT COUNT(*)::int FROM statistics');
    if (statCount[0].count === 0) {
      const stats = [
        ['عدد محطات المياه الكبرى', '29', 'محطة', 'إنتاج', 1],
        ['إجمالي الطاقة التصميمية', '644,609', 'ألف م³ / عام', 'إنتاج', 2],
        ['عدد محطات معالجة الصرف', '37', 'محطة', 'صرف', 3],
        ['عدد المشتركين', '1,086,342', 'مشترك', 'تشغيل', 4],
        ['عدد الفروع', '18', 'فرع', 'تشغيل', 5],
      ];
      for (const s of stats) {
        await client.query(
          `INSERT INTO statistics (label, value, unit, group_name, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          s
        );
      }
      console.log('✅ تم زرع الإحصائيات المبدئية.');
    }

    // 5) خبر ترحيبي تجريبي
    const { rows: newsCount } = await client.query('SELECT COUNT(*)::int FROM news');
    if (newsCount[0].count === 0) {
      await client.query(
        `INSERT INTO news (title, slug, summary, body, is_published)
         VALUES ($1, $2, $3, $4, true)`,
        [
          'مرحبًا بكم في الموقع الجديد',
          'welcome-to-new-website',
          'انطلاق النسخة الجديدة من موقع الشركة الإلكتروني.',
          'يسعدنا الترحيب بكم في النسخة الجديدة من الموقع الإلكتروني للشركة، والتي تتيح لكم متابعة آخر الأخبار والمناقصات والخدمات بسهولة أكبر.',
        ]
      );
      console.log('✅ تم زرع خبر تجريبي.');
    }

    console.log('🎉 اكتمل زرع البيانات المبدئية بنجاح.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('حدث خطأ أثناء زرع البيانات:', err);
  process.exit(1);
});
