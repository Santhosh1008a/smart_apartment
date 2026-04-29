CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE parking_slots
  ADD COLUMN IF NOT EXISTS complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS parking_area VARCHAR(80),
  ADD COLUMN IF NOT EXISTS slot_label VARCHAR(40),
  ADD COLUMN IF NOT EXISTS parking_type VARCHAR(20) DEFAULT 'car',
  ADD COLUMN IF NOT EXISTS slot_kind VARCHAR(30) DEFAULT 'resident',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE parking_slots ALTER COLUMN building_id DROP NOT NULL;
ALTER TABLE parking_slots ALTER COLUMN status DROP DEFAULT;
ALTER TABLE parking_slots ALTER COLUMN status TYPE VARCHAR(20) USING status::text;
ALTER TABLE parking_slots ALTER COLUMN status SET DEFAULT 'available';

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'parking_slots'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE parking_slots
  ADD CONSTRAINT parking_slots_status_check_v2
  CHECK (status IN ('available', 'occupied', 'assigned', 'reserved', 'maintenance', 'inactive'));

UPDATE parking_slots ps
SET complex_id = b.complex_id
FROM buildings b
WHERE ps.building_id = b.id
  AND ps.complex_id IS NULL;

UPDATE parking_slots ps
SET display_name = COALESCE(
    NULLIF(ps.display_name, ''),
    CASE
      WHEN b.name IS NOT NULL AND ps.slot_number IS NOT NULL THEN b.name || ' - Slot ' || ps.slot_number
      WHEN ps.slot_number IS NOT NULL THEN 'Slot ' || ps.slot_number
      ELSE 'Parking Slot ' || LEFT(ps.id::text, 8)
    END
  ),
  parking_area = COALESCE(NULLIF(ps.parking_area, ''), b.name, 'Main Parking'),
  slot_label = COALESCE(NULLIF(ps.slot_label, ''), ps.slot_number)
FROM buildings b
WHERE ps.building_id = b.id;

UPDATE parking_slots
SET display_name = COALESCE(NULLIF(display_name, ''), 'Parking Slot ' || LEFT(id::text, 8)),
    parking_area = COALESCE(NULLIF(parking_area, ''), 'Main Parking'),
    slot_label = COALESCE(NULLIF(slot_label, ''), slot_number, LEFT(id::text, 8)),
    parking_type = COALESCE(NULLIF(parking_type, ''), 'car'),
    slot_kind = COALESCE(NULLIF(slot_kind, ''), 'resident');

CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_slots_complex_display_name
  ON parking_slots (complex_id, LOWER(display_name))
  WHERE complex_id IS NOT NULL AND display_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parking_slots_complex_status
  ON parking_slots (complex_id, status);

CREATE TABLE IF NOT EXISTS parking_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car', 'bike', 'ev', 'other')),
  make_model VARCHAR(80),
  color VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (complex_id, vehicle_number)
);

ALTER TABLE parking_assignments
  ADD COLUMN IF NOT EXISTS complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES parking_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released')),
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE parking_assignments ALTER COLUMN vehicle_number DROP NOT NULL;

UPDATE parking_assignments pa
SET complex_id = ps.complex_id
FROM parking_slots ps
WHERE pa.slot_id = ps.id
  AND pa.complex_id IS NULL;

UPDATE parking_assignments
SET status = CASE WHEN assigned_until IS NULL THEN 'active' ELSE 'released' END
WHERE status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_assignments_active_slot
  ON parking_assignments (slot_id)
  WHERE status = 'active' AND assigned_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_parking_assignments_complex_status
  ON parking_assignments (complex_id, status);

CREATE TABLE IF NOT EXISTS parking_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES parking_vehicles(id) ON DELETE SET NULL,
  request_type VARCHAR(30) NOT NULL DEFAULT 'extra_parking'
    CHECK (request_type IN ('extra_parking', 'visitor_parking', 'slot_change')),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parking_requests_complex_status
  ON parking_requests (complex_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parking_requests_resident
  ON parking_requests (resident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visitor_parking_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES parking_slots(id) ON DELETE SET NULL,
  visitor_pass_id UUID REFERENCES visitor_passes(id) ON DELETE SET NULL,
  visitor_name VARCHAR(120) NOT NULL,
  visitor_phone VARCHAR(20),
  vehicle_number VARCHAR(20) NOT NULL,
  host_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released')),
  checked_in_by UUID REFERENCES users(id),
  released_by UUID REFERENCES users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_visitor_parking_complex_status
  ON visitor_parking_sessions (complex_id, status, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_parking_vehicle
  ON visitor_parking_sessions (complex_id, UPPER(vehicle_number));
