ALTER TABLE incidents ADD COLUMN IF NOT EXISTS generating_source TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS body_part TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS injured_person_report TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS witness_report TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS possible_causes TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS conclusion TEXT;
