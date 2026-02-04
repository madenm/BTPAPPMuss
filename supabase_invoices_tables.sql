-- Système de facturation : tables factures, paiements, numérotation
-- À exécuter dans le SQL Editor de votre projet Supabase

-- Supprimer les tables existantes si elles existent (pour réinstallation propre)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_numbering CASCADE;

-- Supprimer les fonctions existantes
DROP FUNCTION IF EXISTS generate_invoice_number(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Table invoices (factures)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  chantier_id UUID REFERENCES chantiers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms TEXT NOT NULL DEFAULT '30 jours net',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_ht NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tva_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyée', 'payée', 'annulée', 'partiellement_payée')),
  notes TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, invoice_number)
);

-- Table payments (paiements)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('virement', 'cheque', 'especes', 'carte', 'autre')),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table invoice_numbering (numérotation)
CREATE TABLE invoice_numbering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_chantier_id ON invoices(chantier_id);
CREATE INDEX idx_invoices_deleted_at ON invoices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);

-- Fonction pour générer le numéro de facture (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  new_number INTEGER;
  formatted_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Récupérer ou créer la ligne de numérotation pour cet utilisateur et cette année
  INSERT INTO invoice_numbering (user_id, year, last_number)
  VALUES (p_user_id, current_year, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET
    year = CASE 
      WHEN invoice_numbering.year != current_year THEN current_year
      ELSE invoice_numbering.year
    END,
    last_number = CASE
      WHEN invoice_numbering.year != current_year THEN 0
      ELSE invoice_numbering.last_number
    END,
    updated_at = NOW()
  RETURNING last_number INTO new_number;
  
  -- Si l'insertion n'a pas retourné de valeur, récupérer la valeur actuelle
  IF new_number IS NULL THEN
    SELECT last_number INTO new_number
    FROM invoice_numbering
    WHERE user_id = p_user_id AND year = current_year;
  END IF;
  
  -- Incrémenter et mettre à jour
  new_number := new_number + 1;
  
  UPDATE invoice_numbering
  SET last_number = new_number, updated_at = NOW()
  WHERE user_id = p_user_id AND year = current_year;
  
  -- Formater le numéro : FACTURE-YYYY-NNNNN
  formatted_number := 'FACTURE-' || current_year || '-' || LPAD(new_number::TEXT, 5, '0');
  
  RETURN formatted_number;
END;
$$;

-- RLS (Row Level Security)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_numbering ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;

-- Politiques RLS pour invoices
-- SELECT : voir toutes ses factures (y compris annulées) pour permettre annulation + retour du row
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id);

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete their own payments" ON payments;

-- Politiques RLS pour payments
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
  ON payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
  ON payments FOR DELETE
  USING (auth.uid() = user_id);

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own numbering" ON invoice_numbering;
DROP POLICY IF EXISTS "Users can update their own numbering" ON invoice_numbering;

-- Politiques RLS pour invoice_numbering
CREATE POLICY "Users can view their own numbering"
  ON invoice_numbering FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own numbering"
  ON invoice_numbering FOR UPDATE
  USING (auth.uid() = user_id);

-- Permissions pour la fonction generate_invoice_number
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer les triggers existants si ils existent
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
