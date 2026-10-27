CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL, full_name text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS bills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequential_number int NOT NULL, date_based_number text NOT NULL, patient_name text NOT NULL, patient_address text,
  products jsonb NOT NULL DEFAULT '[]', manual_amount numeric(12,2) NOT NULL DEFAULT 0, amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'Cash' CHECK (payment_mode IN ('Cash','Card','UPI')), notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(user_id, sequential_number));
CREATE TABLE IF NOT EXISTS indoor_patients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  indoor_id text NOT NULL, patient_name text NOT NULL, age int, gender text, address text, contact_number text,
  admission_date date NOT NULL DEFAULT current_date, discharge_date date, doctor_department text, room_bed_no text,
  status text NOT NULL DEFAULT 'Admitted' CHECK (status IN ('Admitted','Discharged')), is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(user_id, indoor_id));
CREATE TABLE IF NOT EXISTS indoor_medicines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  indoor_patient_id uuid NOT NULL REFERENCES indoor_patients(id) ON DELETE CASCADE, medicine_name text NOT NULL, unit text,
  quantity numeric(12,2) NOT NULL DEFAULT 1, mrp_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) GENERATED ALWAYS AS (quantity * mrp_per_unit) STORED, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS indoor_bills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  indoor_patient_id uuid NOT NULL UNIQUE REFERENCES indoor_patients(id) ON DELETE CASCADE, invoice_number text NOT NULL,
  item_total numeric(12,2) NOT NULL DEFAULT 0, other_charges numeric(12,2) NOT NULL DEFAULT 0, final_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0, balance numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode text CHECK (payment_mode IN ('Cash','Card','UPI','Hospital Account')),
  payment_status text NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid','Partial','Unpaid')), payment_date date, notes text,
  is_finalized boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS common_medicines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_name text NOT NULL, default_qty numeric(12,2) NOT NULL DEFAULT 1, unit text, mrp_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS bills_user_created ON bills(user_id, created_at DESC);
