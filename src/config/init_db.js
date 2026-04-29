const { pool } = require('./db');

const initialDatabaseScript = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE unit_type_enum AS ENUM ('1BHK', '2BHK', '3BHK', 'penthouse', 'studio');
    CREATE TYPE unit_status_enum AS ENUM ('occupied', 'vacant', 'maintenance');
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'admin', 'resident', 'tenant', 'security', 'vendor');
    CREATE TYPE user_relation_enum AS ENUM ('owner', 'tenant', 'family');
    CREATE TYPE pass_purpose_enum AS ENUM ('guest', 'delivery', 'cab', 'service', 'other');
    CREATE TYPE pass_status_enum AS ENUM ('pending', 'approved', 'checked_in', 'checked_out', 'expired', 'cancelled');
    CREATE TYPE invoice_type_enum AS ENUM ('maintenance', 'rent', 'water', 'electricity', 'clubhouse', 'penalty', 'other');
    CREATE TYPE invoice_status_enum AS ENUM ('draft', 'sent', 'paid', 'overdue', 'partially_paid', 'waived');
    CREATE TYPE payment_method_enum AS ENUM ('razorpay', 'cash', 'cheque', 'bank_transfer', 'wallet');
    CREATE TYPE payment_status_enum AS ENUM ('initiated', 'authorized', 'captured', 'failed', 'refunded');
    CREATE TYPE slot_type_enum AS ENUM ('two_wheeler', 'four_wheeler', 'ev_charging', 'handicapped');
    CREATE TYPE slot_status_enum AS ENUM ('available', 'assigned', 'reserved', 'maintenance');
    CREATE TYPE parking_vehicle_type_enum AS ENUM ('car', 'bike', 'ev');
    CREATE TYPE vendor_category_enum AS ENUM ('plumber', 'electrician', 'carpenter', 'cleaner', 'pest_control', 'painter', 'other');
    CREATE TYPE vendor_req_priority_enum AS ENUM ('low', 'medium', 'high', 'critical');
    CREATE TYPE vendor_req_status_enum AS ENUM ('open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed');
    CREATE TYPE emergency_type_enum AS ENUM ('fire', 'medical', 'security', 'gas_leak', 'flood', 'earthquake', 'other');
    CREATE TYPE emergency_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
    CREATE TYPE emergency_status_enum AS ENUM ('active', 'acknowledged', 'responding', 'resolved', 'false_alarm');
    CREATE TYPE emergency_contact_type_enum AS ENUM ('police', 'fire', 'ambulance', 'security', 'custom');
    CREATE TYPE notification_channel_enum AS ENUM ('in_app', 'push', 'sms', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS complexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    total_floors SMALLINT
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    unit_number VARCHAR(20) NOT NULL,
    floor SMALLINT,
    type unit_type_enum,
    status unit_status_enum DEFAULT 'vacant'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(120),
    role user_role_enum NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_units (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    relation user_relation_enum,
    moved_in_at DATE,
    moved_out_at DATE,
    PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS visitor_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id UUID REFERENCES users(id),
    visitor_name VARCHAR(120) NOT NULL,
    visitor_phone VARCHAR(15),
    purpose pass_purpose_enum,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    status pass_status_enum DEFAULT 'pending',
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_pass_id UUID REFERENCES visitor_passes(id) UNIQUE,
    token VARCHAR(64) UNIQUE NOT NULL,
    scanned_count INT DEFAULT 0,
    max_scans SMALLINT DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id),
    type invoice_type_enum,
    amount NUMERIC(12,2) NOT NULL,
    due_date DATE NOT NULL,
    status invoice_status_enum DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    period_start DATE,
    period_end DATE
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id),
    user_id UUID REFERENCES users(id),
    amount NUMERIC(12,2) NOT NULL,
    method payment_method_enum,
    status payment_status_enum,
    paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS razorpay_txns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id),
    rz_order_id VARCHAR(40) NOT NULL,
    rz_payment_id VARCHAR(40),
    rz_signature TEXT,
    raw_webhook JSONB,
    event VARCHAR(60),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parking_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id),
    slot_number VARCHAR(10) NOT NULL,
    slot_type slot_type_enum,
    floor VARCHAR(10),
    status slot_status_enum DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS parking_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id UUID REFERENCES parking_slots(id),
    unit_id UUID REFERENCES units(id),
    vehicle_number VARCHAR(20),
    vehicle_type parking_vehicle_type_enum,
    assigned_from DATE,
    assigned_until DATE
);

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    category vendor_category_enum,
    phone VARCHAR(15),
    rating NUMERIC(2,1) DEFAULT 0.0,
    is_verified BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS vendor_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    vendor_id UUID REFERENCES vendors(id),
    unit_id UUID REFERENCES units(id),
    category vendor_category_enum,
    description TEXT,
    priority vendor_req_priority_enum DEFAULT 'medium',
    status vendor_req_status_enum DEFAULT 'open',
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    review TEXT
);

CREATE TABLE IF NOT EXISTS emergency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    unit_id UUID REFERENCES units(id),
    type emergency_type_enum,
    severity emergency_severity_enum DEFAULT 'high',
    description TEXT,
    status emergency_status_enum DEFAULT 'active',
    location_lat NUMERIC(9,6),
    location_lng NUMERIC(9,6),
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complex_id UUID REFERENCES complexes(id),
    label VARCHAR(60),
    phone VARCHAR(15),
    type emergency_contact_type_enum
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES users(id),
    action VARCHAR(60),
    entity_type VARCHAR(40),
    entity_id UUID,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(200),
    body TEXT,
    channel notification_channel_enum,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Note: Complex indexes are better maintained via migrations in production,
-- but creating base ones for initialization here.
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_user_units_user ON user_units (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_unit_status ON invoices (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_host ON visitor_passes (host_user_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_token ON qr_codes (token);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);
`;

async function initDB() {
  try {
    console.log('Initializing Database Schema...');
    await pool.query(initialDatabaseScript);
    console.log('Database Schema Initialization Complete!');
  } catch (err) {
    console.error('Error initializing database', err);
  } finally {
    process.exit(0);
  }
}

initDB();
