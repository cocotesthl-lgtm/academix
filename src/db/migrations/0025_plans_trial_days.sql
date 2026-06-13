-- =====================================================================
-- 0025_plans_trial_days.sql
-- Trial days configurable por plan.
-- 0 = trial OFF, >0 = N días de trial gratis con MP free_trial.
-- =====================================================================

alter table public.plans
  add column if not exists trial_days integer not null default 0;

-- Seed: por default activamos 7 días de trial a Medium y Pro (los que el
-- founder vende). Initial sin trial (es el plan free de fallback).
update public.plans set trial_days = 7
  where slug in ('medium', 'pro') and trial_days = 0;
