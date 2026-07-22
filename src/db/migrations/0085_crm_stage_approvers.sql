-- 0085_crm_stage_approvers.sql
-- Aprobadores por etapa: cada crm_stage puede tener una lista de user_ids
-- (miembros del tenant) que son los únicos autorizados a mover un lead
-- HACIA esa etapa. Vacío = cualquiera puede (comportamiento default).
--
-- Caso de uso: gating de auditoría. La etapa "Aprobado" o "Facturación"
-- sólo la puede aprobar el auditor/CFO — el resto del equipo pone leads
-- en las etapas anteriores y cuando el auditor mueve el lead a "Aprobado",
-- queda auditado.
--
-- Enforcement se hace a nivel server action (moveLeadAction, createLeadAction,
-- updateLeadAction). No usamos RLS aquá porque queremos permitir LEER todas
-- las etapas, solo restringir el ESCRIBIR-hacia.

alter table public.crm_stages
  add column if not exists approver_user_ids uuid[] not null default '{}'::uuid[];

comment on column public.crm_stages.approver_user_ids is
  'Members allowed to move leads INTO this stage. Empty array = anyone with CRM access.';
