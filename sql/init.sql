CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--DROP TABLE IF EXISTS roles CASCADE;
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  modified_at TIMESTAMP,
  modified_by VARCHAR(100),
  row_status BOOLEAN DEFAULT TRUE
);
--DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role_id UUID REFERENCES roles(id) NOT NULL,
  verify_email BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  modified_at TIMESTAMP NULL,
  modified_by VARCHAR(100)  NULL,
  row_status BOOLEAN DEFAULT TRUE
);
--DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE IF NOT EXISTS  payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE NOT NULL,
  billing_date_for DATE DEFAULT CURRENT_DATE NOT NULL,
  payment_number BIGSERIAL UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  modified_at TIMESTAMP,
  modified_by VARCHAR(100),
  row_status BOOLEAN DEFAULT TRUE
);

--DROP TABLE IF EXISTS user_details CASCADE;
CREATE TABLE IF NOT EXISTS user_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  verify_phone BOOLEAN DEFAULT FALSE NOT NULL,
  address TEXT NULL,
  billing_date DATE NOT NULL,
  package numeric DEFAULT 100000 NOT NULL,
  is_subscribe BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  modified_at TIMESTAMP NULL,
  modified_by VARCHAR(100) NULL,
  row_status BOOLEAN DEFAULT TRUE
);
--DROP TABLE IF EXISTS otp_codes CASCADE;
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NULL,
    email VARCHAR(100) UNIQUE NULL,
    phone VARCHAR(20) UNIQUE NULL,
    otp_code VARCHAR(10) NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

--DROP INDEX IF EXISTS unique_email_lower;
CREATE UNIQUE INDEX IF NOT EXISTS unique_email_lower ON users (LOWER(email));
--DROP INDEX IF EXISTS unique_name_lower;
CREATE UNIQUE INDEX IF NOT EXISTS unique_name_lower ON roles (LOWER(name));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM roles) THEN
    INSERT INTO roles (name, description, created_by)
    VALUES 
      ('Admin', 'Role admin', 'system'),
      ('User', 'Role user', 'system');
  END IF;
END
$$;



