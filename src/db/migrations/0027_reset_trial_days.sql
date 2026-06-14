-- =====================================================================
-- 0027_reset_trial_days.sql
-- Resetea trial_days a 0 en todos los planes (decisión del founder:
-- no ofrecer trials by default). El campo sigue editable, pero los
-- seeds quedan sin trial.
-- =====================================================================

update public.plans set trial_days = 0 where trial_days > 0;
