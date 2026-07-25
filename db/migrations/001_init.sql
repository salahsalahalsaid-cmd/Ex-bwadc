-- ============================================================
-- مخطط قاعدة بيانات موقع شركة مياه الشرب والصرف الصحي
-- PostgreSQL Schema
-- ============================================================

-- جدول تتبّع نُسخ قاعدة البيانات (يُستخدم في نظام الترقية/الأبجريد)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    filename    TEXT UNIQUE NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول المدراء (يدخلوا على لوحة التحكم)
CREATE TABLE IF NOT EXISTS admin_users (
    id              SERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'editor', -- editor | superadmin
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول الأخبار
CREATE TABLE IF NOT EXISTS news (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    summary         TEXT,
    body            TEXT NOT NULL,
    cover_image     TEXT,
    is_published    BOOLEAN NOT NULL DEFAULT true,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news (is_published, published_at DESC);

-- جدول المناقصات والممارسات
CREATE TABLE IF NOT EXISTS tenders (
    id                  SERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    description         TEXT NOT NULL,
    booklet_price       NUMERIC(12,2),
    initial_insurance   NUMERIC(12,2),
    opening_session_at  TIMESTAMPTZ,
    is_published        BOOLEAN NOT NULL DEFAULT true,
    published_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenders_published ON tenders (is_published, published_at DESC);

-- جدول الخدمات (استعلام فاتورة، إرسال قراءة، فروع...الخ)
CREATE TABLE IF NOT EXISTS services (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    icon            TEXT,          -- اسم أيقونة أو مسار صورة
    link_url        TEXT,          -- رابط الخدمة (داخلي أو خارجي)
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

-- جدول الإحصائيات (عدد الفروع، المشتركين، المحطات...الخ)
CREATE TABLE IF NOT EXISTS statistics (
    id              SERIAL PRIMARY KEY,
    label           TEXT NOT NULL,
    value           TEXT NOT NULL,
    unit            TEXT,
    group_name      TEXT,          -- لتجميع الإحصائيات في نفس القسم
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- جدول إعدادات الموقع العامة (اسم الشركة، أرقام التليفونات، السوشيال ميديا...الخ)
CREATE TABLE IF NOT EXISTS site_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT
);

-- جدول الفروع
CREATE TABLE IF NOT EXISTS branches (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    latitude        NUMERIC(10,6),
    longitude       NUMERIC(10,6),
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- جدول شكاوى ومقترحات المواطنين (نسخة داخلية بسيطة، اختيارية)
CREATE TABLE IF NOT EXISTS complaints (
    id              SERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    phone           TEXT NOT NULL,
    address         TEXT,
    subject         TEXT NOT NULL,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'new', -- new | in_progress | resolved
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
