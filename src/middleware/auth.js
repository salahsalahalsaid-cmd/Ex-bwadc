/**
 * src/middleware/auth.js
 * يتأكد إن فيه مستخدم مسجّل دخوله في الجلسة (session) قبل ما يدخل
 * أي صفحة من صفحات لوحة التحكم (/admin/*).
 */

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUser) {
    return next();
  }
  return res.redirect('/admin/login');
}

// يمرر بيانات المدير الحالي (لو موجود) لكل الـ views تلقائيًا
function attachAdminToLocals(req, res, next) {
  res.locals.currentAdmin = (req.session && req.session.adminUser) || null;
  next();
}

module.exports = { requireAdmin, attachAdminToLocals };
