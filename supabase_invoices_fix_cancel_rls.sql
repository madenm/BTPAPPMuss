-- Correction RLS : permettre l'annulation de facture (UPDATE + retour du row)
-- À exécuter dans le SQL Editor Supabase (sans toucher aux données)

DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;

CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);
