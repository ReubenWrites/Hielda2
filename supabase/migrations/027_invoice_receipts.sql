-- Applied to production 2026-09-22.
--
-- Receipts attached to invoices (Uber, train tickets, materials...). The file
-- lives in the private 'receipts' storage bucket under <user_id>/<invoice_id>/;
-- this row records which line it belongs to, what Claude extracted from it,
-- and whether it is appended to the invoice PDF the client receives.
create table if not exists invoice_receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  line_index int,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int,
  include_in_invoice boolean not null default true,
  extracted jsonb,
  created_at timestamptz not null default now()
);
create index if not exists invoice_receipts_invoice_idx on invoice_receipts (invoice_id);
alter table invoice_receipts enable row level security;
create policy "own receipts" on invoice_receipts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Each user may only touch objects under their own folder.
create policy "receipts owner select" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner update" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
