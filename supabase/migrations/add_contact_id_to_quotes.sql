-- Add contact_id column to quotes table
ALTER TABLE quotes 
ADD COLUMN contact_id UUID REFERENCES prospects(id) ON DELETE SET NULL;

-- Create index on contact_id for better query performance
CREATE INDEX idx_quotes_contact_id ON quotes(contact_id);
