require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const methodOverride = require('method-override');

const db = require('./db');
const { attachAdminToLocals } = require('./middleware/auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// إعدادات محرك القوالب (EJS)
// ---------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ---------------------------------------------------------------
// الملفات الثابتة (CSS / JS / صور الرفع)
// ---------------------------------------------------------------
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------------
// قراءة بيانات الفورمات
// ---------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// ---------------------------------------------------------------
// الجلسات (Sessions) - مخزّنة في PostgreSQL نفسها (جدول session)
// ---------------------------------------------------------------
app.use(
  session({
    store: new pgSession({ pool: db.pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 ساعات
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use(attachAdminToLocals);

// ---------------------------------------------------------------
// الراوتس
// ---------------------------------------------------------------
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

// ---------------------------------------------------------------
// صفحة 404
// ---------------------------------------------------------------
app.use(async (req, res) => {
  const { getSettings } = require('./routes/public');
  const settings = await getSettings();
  res.status(404).render('404', { settings, pageTitle: 'الصفحة غير موجودة' });
});

// ---------------------------------------------------------------
// معالج الأخطاء العام
// ---------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('❌ خطأ في السيرفر:', err);
  res.status(500).send(
    process.env.NODE_ENV === 'production'
      ? 'حدث خطأ غير متوقع، برجاء المحاولة لاحقًا.'
      : `<pre dir="ltr">${err.stack}</pre>`
  );
});

app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على: http://localhost:${PORT}`);
});
