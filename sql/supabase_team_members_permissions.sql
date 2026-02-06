-- Add comprehensive permissions columns to team_members table.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- This allows the admin to control which features team members can access.

-- Permissions pour les fonctionnalités principales
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_view_dashboard BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_use_estimation BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_view_all_chantiers BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_chantiers BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_view_planning BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_planning BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_access_crm BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_create_quotes BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_invoices BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_use_ai_visualization BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_team BOOLEAN DEFAULT false;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_clients BOOLEAN DEFAULT false;

-- Set default values for existing members (all permissions disabled by default)
UPDATE team_members
SET 
  can_view_dashboard = COALESCE(can_view_dashboard, false),
  can_use_estimation = COALESCE(can_use_estimation, false),
  can_view_all_chantiers = COALESCE(can_view_all_chantiers, false),
  can_manage_chantiers = COALESCE(can_manage_chantiers, false),
  can_view_planning = COALESCE(can_view_planning, false),
  can_manage_planning = COALESCE(can_manage_planning, false),
  can_access_crm = COALESCE(can_access_crm, false),
  can_create_quotes = COALESCE(can_create_quotes, false),
  can_manage_invoices = COALESCE(can_manage_invoices, false),
  can_use_ai_visualization = COALESCE(can_use_ai_visualization, false),
  can_manage_team = COALESCE(can_manage_team, false),
  can_manage_clients = COALESCE(can_manage_clients, false)
WHERE 
  can_view_dashboard IS NULL OR
  can_use_estimation IS NULL OR
  can_view_all_chantiers IS NULL OR
  can_manage_chantiers IS NULL OR
  can_view_planning IS NULL OR
  can_manage_planning IS NULL OR
  can_access_crm IS NULL OR
  can_create_quotes IS NULL OR
  can_manage_invoices IS NULL OR
  can_use_ai_visualization IS NULL OR
  can_manage_team IS NULL OR
  can_manage_clients IS NULL;
