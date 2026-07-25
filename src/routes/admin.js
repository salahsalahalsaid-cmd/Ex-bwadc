const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// ---------------------------------------------------------------
// إعداد رفع الصور (multer) - بتتخزن جوه public/uploads
// ---------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('نوع الملف غير مسموح به (يجب أن تكون صورة)'), ok);
  },
});

// دالة تحويل النص العربي/الإنجليزي إلى slug صالح للروابط
function slugify(text) {
  return (
    text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
      .replace(/-+/g, '-') +
    '-' +
    Date.now().toString().slice(-5)
  ); // بنضيف رقم عشوائي بسيط لضمان تفرد الرابط
}

// ---------------------------------------------------------------
// تسجيل الدخول / الخروج
// ---------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session.adminUser) return res.redirect('/admin');
  res.render('admin/login', { error: null, pageTitle: 'تسجيل دخول لوحة التحكم' });
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM admin_users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).render('admin/login', {
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        pageTitle: 'تسجيل دخول لوحة التحكم',
      });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).render('admin/login', {
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        pageTitle: 'تسجيل دخول لوحة التحكم',
      });
    }
    req.session.adminUser = { id: user.id, full_name: user.full_name, email: user.email, role: user.role };
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// كل الراوتس بعد كده لازم المدير يكون مسجل دخول
router.use(requireAdmin);

// ---------------------------------------------------------------
// لوحة التحكم الرئيسية
// ---------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [newsCount, tendersCount, complaintsCount, servicesCount] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS c FROM news'),
      db.query('SELECT COUNT(*)::int AS c FROM tenders'),
      db.query("SELECT COUNT(*)::int AS c FROM complaints WHERE status = 'new'"),
      db.query('SELECT COUNT(*)::int AS c FROM services'),
    ]);
    res.render('admin/dashboard', {
      pageTitle: 'لوحة التحكم',
      counts: {
        news: newsCount.rows[0].c,
        tenders: tendersCount.rows[0].c,
        complaints: complaintsCount.rows[0].c,
        services: servicesCount.rows[0].c,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// إدارة الأخبار
// ---------------------------------------------------------------
router.get('/news', async (req, res, next) => {
  try {
    const { rows: news } = await db.query('SELECT * FROM news ORDER BY created_at DESC');
    res.render('admin/news-list', { pageTitle: 'إدارة الأخبار', news });
  } catch (err) {
    next(err);
  }
});

router.get('/news/new', (req, res) => {
  res.render('admin/news-form', { pageTitle: 'إضافة خبر جديد', article: {}, isEdit: false });
});

router.post('/news', upload.single('cover_image'), async (req, res, next) => {
  try {
    const { title, summary, body, is_published } = req.body;
    const slug = slugify(title);
    const coverImage = req.file ? '/uploads/' + req.file.filename : null;
    await db.query(
      `INSERT INTO news (title, slug, summary, body, cover_image, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [title, slug, summary, body, coverImage, is_published === 'on', req.session.adminUser.id]
    );
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

router.get('/news/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/news');
    res.render('admin/news-form', { pageTitle: 'تعديل خبر', article: rows[0], isEdit: true });
  } catch (err) {
    next(err);
  }
});

router.post('/news/:id', upload.single('cover_image'), async (req, res, next) => {
  try {
    const { title, summary, body, is_published } = req.body;
    if (req.file) {
      await db.query(
        `UPDATE news SET title=$1, summary=$2, body=$3, cover_image=$4, is_published=$5, updated_at=now()
         WHERE id=$6`,
        [title, summary, body, '/uploads/' + req.file.filename, is_published === 'on', req.params.id]
      );
    } else {
      await db.query(
        `UPDATE news SET title=$1, summary=$2, body=$3, is_published=$4, updated_at=now()
         WHERE id=$5`,
        [title, summary, body, is_published === 'on', req.params.id]
      );
    }
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

router.post('/news/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// إدارة المناقصات
// ---------------------------------------------------------------
router.get('/tenders', async (req, res, next) => {
  try {
    const { rows: tenders } = await db.query('SELECT * FROM tenders ORDER BY created_at DESC');
    res.render('admin/tenders-list', { pageTitle: 'إدارة المناقصات', tenders });
  } catch (err) {
    next(err);
  }
});

router.get('/tenders/new', (req, res) => {
  res.render('admin/tenders-form', { pageTitle: 'إضافة مناقصة', tender: {}, isEdit: false });
});

router.post('/tenders', async (req, res, next) => {
  try {
    const { title, description, booklet_price, initial_insurance, opening_session_at, is_published } = req.body;
    const slug = slugify(title);
    await db.query(
      `INSERT INTO tenders (title, slug, description, booklet_price, initial_insurance, opening_session_at, is_published, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        title,
        slug,
        description,
        booklet_price || null,
        initial_insurance || null,
        opening_session_at || null,
        is_published === 'on',
        req.session.adminUser.id,
      ]
    );
    res.redirect('/admin/tenders');
  } catch (err) {
    next(err);
  }
});

router.get('/tenders/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM tenders WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/tenders');
    res.render('admin/tenders-form', { pageTitle: 'تعديل مناقصة', tender: rows[0], isEdit: true });
  } catch (err) {
    next(err);
  }
});

router.post('/tenders/:id', async (req, res, next) => {
  try {
    const { title, description, booklet_price, initial_insurance, opening_session_at, is_published } = req.body;
    await db.query(
      `UPDATE tenders SET title=$1, description=$2, booklet_price=$3, initial_insurance=$4,
       opening_session_at=$5, is_published=$6, updated_at=now() WHERE id=$7`,
      [
        title,
        description,
        booklet_price || null,
        initial_insurance || null,
        opening_session_at || null,
        is_published === 'on',
        req.params.id,
      ]
    );
    res.redirect('/admin/tenders');
  } catch (err) {
    next(err);
  }
});

router.post('/tenders/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    res.redirect('/admin/tenders');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// إدارة الخدمات
// ---------------------------------------------------------------
router.get('/services', async (req, res, next) => {
  try {
    const { rows: services } = await db.query('SELECT * FROM services ORDER BY sort_order ASC');
    res.render('admin/services-list', { pageTitle: 'إدارة الخدمات', services });
  } catch (err) {
    next(err);
  }
});

router.post('/services', async (req, res, next) => {
  try {
    const { title, description, icon, link_url, sort_order } = req.body;
    await db.query(
      `INSERT INTO services (title, description, icon, link_url, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [title, description, icon, link_url, sort_order || 0]
    );
    res.redirect('/admin/services');
  } catch (err) {
    next(err);
  }
});

router.post('/services/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    res.redirect('/admin/services');
  } catch (err) {
    next(err);
  }
});

router.post('/services/:id/toggle', async (req, res, next) => {
  try {
    await db.query('UPDATE services SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.redirect('/admin/services');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// إدارة الإحصائيات
// ---------------------------------------------------------------
router.get('/statistics', async (req, res, next) => {
  try {
    const { rows: stats } = await db.query('SELECT * FROM statistics ORDER BY sort_order ASC');
    res.render('admin/statistics-list', { pageTitle: 'إدارة الإحصائيات', stats });
  } catch (err) {
    next(err);
  }
});

router.post('/statistics', async (req, res, next) => {
  try {
    const { label, value, unit, group_name, sort_order } = req.body;
    await db.query(
      `INSERT INTO statistics (label, value, unit, group_name, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [label, value, unit, group_name, sort_order || 0]
    );
    res.redirect('/admin/statistics');
  } catch (err) {
    next(err);
  }
});

router.post('/statistics/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM statistics WHERE id = $1', [req.params.id]);
    res.redirect('/admin/statistics');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// إعدادات الموقع العامة
// ---------------------------------------------------------------
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM site_settings ORDER BY key ASC');
    res.render('admin/settings', { pageTitle: 'إعدادات الموقع', settingsRows: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/settings', async (req, res, next) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    res.redirect('/admin/settings');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// عرض الشكاوى الواردة من الزوار
// ---------------------------------------------------------------
router.get('/complaints', async (req, res, next) => {
  try {
    const { rows: complaints } = await db.query('SELECT * FROM complaints ORDER BY created_at DESC');
    res.render('admin/complaints-list', { pageTitle: 'الشكاوى والمقترحات', complaints });
  } catch (err) {
    next(err);
  }
});

router.post('/complaints/:id/status', async (req, res, next) => {
  try {
    await db.query('UPDATE complaints SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
    res.redirect('/admin/complaints');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
