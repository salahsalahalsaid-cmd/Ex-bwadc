const express = require('express');
const router = express.Router();
const db = require('../db');

// دالة مساعدة لجلب كل إعدادات الموقع كـ object جاهز للاستخدام في الـ views
async function getSettings() {
  const { rows } = await db.query('SELECT key, value FROM site_settings');
  const settings = {};
  rows.forEach((r) => (settings[r.key] = r.value));
  return settings;
}

// ---------------------------------------------------------------
// الصفحة الرئيسية
// ---------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [settings, news, tenders, services, stats] = await Promise.all([
      getSettings(),
      db.query(
        `SELECT id, title, slug, summary, cover_image, published_at
         FROM news WHERE is_published = true
         ORDER BY published_at DESC LIMIT 6`
      ),
      db.query(
        `SELECT id, title, slug, description, published_at
         FROM tenders WHERE is_published = true
         ORDER BY published_at DESC LIMIT 4`
      ),
      db.query(
        `SELECT id, title, description, icon, link_url
         FROM services WHERE is_active = true
         ORDER BY sort_order ASC`
      ),
      db.query(
        `SELECT label, value, unit, group_name
         FROM statistics ORDER BY sort_order ASC`
      ),
    ]);

    res.render('home', {
      settings,
      news: news.rows,
      tenders: tenders.rows,
      services: services.rows,
      stats: stats.rows,
      pageTitle: settings.site_name || 'الصفحة الرئيسية',
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// قائمة الأخبار (مع Pagination بسيط)
// ---------------------------------------------------------------
router.get('/news', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const perPage = 9;
    const offset = (page - 1) * perPage;

    const settings = await getSettings();
    const { rows: news } = await db.query(
      `SELECT id, title, slug, summary, cover_image, published_at
       FROM news WHERE is_published = true
       ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
      [perPage, offset]
    );
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM news WHERE is_published = true`
    );
    const totalPages = Math.max(Math.ceil(countRows[0].total / perPage), 1);

    res.render('news-list', {
      settings,
      news,
      page,
      totalPages,
      pageTitle: 'الأخبار',
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// تفاصيل خبر واحد
// ---------------------------------------------------------------
router.get('/news/:slug', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { rows } = await db.query(
      `SELECT * FROM news WHERE slug = $1 AND is_published = true`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).render('404', { settings, pageTitle: 'الصفحة غير موجودة' });
    }
    res.render('news-single', { settings, article: rows[0], pageTitle: rows[0].title });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// قائمة المناقصات
// ---------------------------------------------------------------
router.get('/tenders', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { rows: tenders } = await db.query(
      `SELECT * FROM tenders WHERE is_published = true ORDER BY published_at DESC`
    );
    res.render('tenders-list', { settings, tenders, pageTitle: 'المناقصات والممارسات' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// الفروع
// ---------------------------------------------------------------
router.get('/branches', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { rows: branches } = await db.query(
      `SELECT * FROM branches ORDER BY sort_order ASC`
    );
    res.render('branches', { settings, branches, pageTitle: 'الفروع' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// نموذج الشكاوى والمقترحات
// ---------------------------------------------------------------
router.get('/complaints', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.render('complaints', { settings, pageTitle: 'شكاوى ومقترحات', success: false });
  } catch (err) {
    next(err);
  }
});

router.post('/complaints', async (req, res, next) => {
  try {
    const { full_name, phone, address, subject, message } = req.body;
    if (!full_name || !phone || !subject || !message) {
      const settings = await getSettings();
      return res.status(400).render('complaints', {
        settings,
        pageTitle: 'شكاوى ومقترحات',
        success: false,
        error: 'من فضلك املأ كل الحقول المطلوبة.',
      });
    }
    await db.query(
      `INSERT INTO complaints (full_name, phone, address, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [full_name, phone, address || null, subject, message]
    );
    const settings = await getSettings();
    res.render('complaints', { settings, pageTitle: 'شكاوى ومقترحات', success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.getSettings = getSettings;
