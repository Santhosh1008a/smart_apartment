-- ============================================================
-- Smart Apartment Management System — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20)  UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'resident'
                CHECK (role IN ('resident','admin','super_admin','security','vendor')),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  avatar_url    TEXT,
  complex_id    UUID         REFERENCES complexes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. COMPLEXES
-- ============================================================
CREATE TABLE complexes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. BUILDINGS
-- ============================================================
CREATE TABLE buildings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id   UUID         NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  total_floors INT          NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. UNITS
-- ============================================================
CREATE TABLE units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID         NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_number VARCHAR(20)  NOT NULL,
  floor       INT,
  type        VARCHAR(20)  DEFAULT 'apartment'
              CHECK (type IN ('apartment','studio','penthouse','shop','office')),
  status      VARCHAR(20)  NOT NULL DEFAULT 'vacant'
              CHECK (status IN ('vacant','occupied','maintenance')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (building_id, unit_number)
);

-- ============================================================
-- 5. USER ↔ UNIT MAPPING
-- ============================================================
CREATE TABLE user_units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id     UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  relation    VARCHAR(20) NOT NULL DEFAULT 'owner'
              CHECK (relation IN ('owner','tenant','family')),
  moved_in_at  DATE       NOT NULL DEFAULT CURRENT_DATE,
  moved_out_at DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. VISITOR PASSES
-- ============================================================
CREATE TABLE visitor_passes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visitor_name   VARCHAR(255) NOT NULL,
  visitor_phone  VARCHAR(20),
  purpose        TEXT,
  valid_from     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  valid_until    TIMESTAMPTZ  NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','checked_in','checked_out','cancelled')),
  checked_in_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. QR CODES (linked to visitor passes)
-- ============================================================
CREATE TABLE qr_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_pass_id UUID    NOT NULL REFERENCES visitor_passes(id) ON DELETE CASCADE,
  token           TEXT    NOT NULL UNIQUE,
  scanned_count   INT    NOT NULL DEFAULT 0,
  max_scans       INT    NOT NULL DEFAULT 1,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. INVOICES
-- ============================================================
CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id      UUID           NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  type         VARCHAR(50)    NOT NULL
               CHECK (type IN ('maintenance','water','electricity','parking','other')),
  amount       NUMERIC(12,2)  NOT NULL,
  due_date     DATE           NOT NULL,
  status       VARCHAR(20)    NOT NULL DEFAULT 'sent'
               CHECK (status IN ('draft','sent','paid','overdue','waived')),
  created_by   UUID           REFERENCES users(id),
  period_start DATE,
  period_end   DATE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID           NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id    UUID           NOT NULL REFERENCES users(id),
  amount     NUMERIC(12,2)  NOT NULL,
  method     VARCHAR(20)    NOT NULL DEFAULT 'razorpay'
             CHECK (method IN ('razorpay','cash','cheque','bank_transfer')),
  status     VARCHAR(20)    NOT NULL DEFAULT 'initiated'
             CHECK (status IN ('initiated','captured','failed','refunded')),
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. RAZORPAY TRANSACTIONS
-- ============================================================
CREATE TABLE razorpay_txns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  rz_order_id   TEXT,
  rz_payment_id TEXT,
  rz_signature  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. EMERGENCY ALERTS
-- ============================================================
CREATE TABLE emergency_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES users(id),
  unit_id      UUID         REFERENCES units(id),
  type         VARCHAR(50)  NOT NULL,
  severity     VARCHAR(20)  NOT NULL DEFAULT 'high'
               CHECK (severity IN ('low','medium','high','critical')),
  description  TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','acknowledged','resolved')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 12. PARKING SLOTS
-- ============================================================
CREATE TABLE parking_slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id   UUID REFERENCES complexes(id) ON DELETE CASCADE,
  building_id  UUID REFERENCES buildings(id) ON DELETE CASCADE,
  display_name VARCHAR(120),
  parking_area VARCHAR(80),
  slot_label   VARCHAR(40),
  slot_number  VARCHAR(20) NOT NULL,
  type         VARCHAR(20) DEFAULT 'car'
               CHECK (type IN ('car','bike','ev')),
  parking_type VARCHAR(20) DEFAULT 'car',
  slot_kind    VARCHAR(30) DEFAULT 'resident',
  status       VARCHAR(20) NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','occupied','assigned','reserved','maintenance','inactive')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (building_id, slot_number)
);

-- ============================================================
-- 13. PARKING ASSIGNMENTS
-- ============================================================
CREATE TABLE parking_assignments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id        UUID        NOT NULL REFERENCES parking_slots(id) ON DELETE CASCADE,
  unit_id        UUID        NOT NULL REFERENCES units(id),
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_type   VARCHAR(20),
  assigned_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_until TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 14. VENDORS
-- ============================================================
CREATE TABLE vendors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(50)  NOT NULL
              CHECK (category IN ('plumber','electrician','carpenter','painter','cleaner','security','other')),
  phone       VARCHAR(20),
  email       VARCHAR(255),
  is_verified BOOLEAN      NOT NULL DEFAULT false,
  rating      NUMERIC(2,1) DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 15. VENDOR REQUESTS
-- ============================================================
CREATE TABLE vendor_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id),
  unit_id     UUID        NOT NULL REFERENCES units(id),
  assigned_vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category    VARCHAR(50) NOT NULL,
  description TEXT,
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','urgent')),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USEFUL INDEXES
-- ============================================================
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_role         ON users(role);
CREATE INDEX idx_users_complex_id   ON users(complex_id);
CREATE INDEX idx_user_units_user    ON user_units(user_id);
CREATE INDEX idx_user_units_unit    ON user_units(unit_id);
CREATE INDEX idx_invoices_unit      ON invoices(unit_id);
CREATE INDEX idx_invoices_status    ON invoices(status);
CREATE INDEX idx_payments_invoice   ON payments(invoice_id);
CREATE INDEX idx_visitor_passes_host ON visitor_passes(host_user_id);
CREATE INDEX idx_qr_codes_token     ON qr_codes(token);
CREATE INDEX idx_emergency_user     ON emergency_alerts(user_id);

-- ============================================================
-- AUTO-UPDATE updated_at ON USERS TABLE
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Default Super Admin (password: admin123)
-- Change this password immediately after first login!
-- Hash generated with bcrypt, 10 salt rounds
-- ============================================================
-- To generate your own hash, run in Node:
--   const bcrypt = require('bcrypt');
--   bcrypt.hash('your_password', 10).then(console.log);
--
-- INSERT INTO users (email, phone, password_hash, full_name, role)
-- VALUES (
--   'admin@smartapartment.com',
--   '9999999999',
--   '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
--   'Super Admin',
--   'super_admin'
-- );
