-- =============================================================================
-- Fonction RPC : génération du numéro de facture unique (format YYYYNNNNNN)
-- =============================================================================
-- Exécuter dans le SQL Editor du projet Supabase (Staging ou Prod)

create or replace function public.generate_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year int := extract(year from current_date)::int;
  max_num int;
  next_num int;
begin
  select coalesce(max(
    (regexp_replace(invoice_number, '^' || current_year, ''))::int
  ), 0) into max_num
  from invoices
  where user_id = p_user_id
    and invoice_number ~ ('^' || current_year::text || '[0-9]+$');
  next_num := max_num + 1;
  return current_year::text || lpad(next_num::text, 6, '0');
end;
$$;

grant execute on function public.generate_invoice_number(uuid) to authenticated;
grant execute on function public.generate_invoice_number(uuid) to service_role;
grant execute on function public.generate_invoice_number(uuid) to anon;

comment on function public.generate_invoice_number(uuid) is 'Génère un numéro de facture unique par utilisateur et par année (format YYYYNNNNNN)';
