-- Add CHECK constraint for type_chantier column in chantiers table.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- This ensures type_chantier can only contain valid values.

-- First, drop the existing constraint if it exists
DO $$ 
BEGIN
    -- Try to drop the constraint if it exists
    ALTER TABLE chantiers DROP CONSTRAINT IF EXISTS chantiers_type_chantier_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add the new CHECK constraint with all valid types
ALTER TABLE chantiers
ADD CONSTRAINT chantiers_type_chantier_check 
CHECK (
    type_chantier IS NULL OR 
    type_chantier IN (
        'piscine',
        'paysage',
        'menuiserie',
        'renovation',
        'plomberie',
        'maconnerie',
        'terrasse',
        'chauffage',
        'isolation',
        'electricite',
        'peinture',
        'autre'
    )
);
