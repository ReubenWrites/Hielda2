-- Xero integration: one connection per user, tokens server-side only.
create table if not exists xero_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_result text
);
alter table xero_connections enable row level security;
-- Deliberately NO policies: OAuth tokens must never reach the browser.
-- All reads/writes go through server endpoints using the service role.

-- Link imported invoices back to their Xero source for dedupe + sync.
alter table invoices add column if not exists xero_invoice_id text;
alter table invoices add column if not exists source text not null default 'manual';
create unique index if not exists invoices_user_xero_invoice
  on invoices (user_id, xero_invoice_id) where xero_invoice_id is not null;
