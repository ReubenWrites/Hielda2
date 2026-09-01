-- When the work itself was done — distinct from the issue date, useful
-- on disputes ("this invoice covers work completed on X") and for
-- freelancers invoicing after the fact.
alter table invoices add column if not exists work_date date;
