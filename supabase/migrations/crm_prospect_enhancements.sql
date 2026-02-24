-- Add new columns to the prospects table for CRM enhancements
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linked_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_action_type TEXT;

-- Update stage CHECK constraint to include 'won' and 'lost'
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_stage_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_stage_check CHECK (
  stage IN ('all', 'quote', 'quote_followup1', 'quote_followup2', 'invoice', 'invoice_followup1', 'invoice_followup2', 'won', 'lost')
);
