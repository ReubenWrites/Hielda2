-- Applied to production 2026-09-18.
--
-- The chase_stage check listed the original five stage ids (reminder,
-- check_in, first_chase, second_chase, final_notice). The ladder has been
-- rebuilt twice since; the app now writes reminder_1/2, final_warning,
-- third_chase, chase_4, formal_N, lba_prompt, statement... Every such
-- update was rejected, which is why chase_stage was NULL on every invoice
-- in production. The ladder is defined in code (CHASE_STAGES +
-- stageForDay); the column is free text.
alter table invoices drop constraint if exists invoices_chase_stage_check;

-- The dispute flow sets status = 'disputed' (Detail.jsx), which the status
-- check never allowed.
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('pending', 'overdue', 'paid', 'cancelled', 'disputed'));
