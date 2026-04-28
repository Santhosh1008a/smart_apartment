-- Migration to add complex_id to users

ALTER TABLE users 
ADD COLUMN complex_id UUID REFERENCES complexes(id) ON DELETE SET NULL;

CREATE INDEX idx_users_complex_id ON users(complex_id);
