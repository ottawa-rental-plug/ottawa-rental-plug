-- Phase 3: Document management (leases, screening reports, ID verification)

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  type text not null, -- lease, screening, id, proof_income, rental_history, reference, other
  file_name text not null,
  file_path text not null, -- storage bucket path
  file_size bigint, -- bytes
  mime_type text, -- application/pdf, image/jpeg, etc
  uploaded_by text, -- email of uploader
  uploaded_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists documents_applicant_idx on documents(applicant_id);
create index if not exists documents_type_idx on documents(type);
create index if not exists documents_uploaded_at_idx on documents(uploaded_at);

alter table documents enable row level security;
create policy documents_admin_all on documents for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);
create policy documents_authenticated_insert on documents for insert to authenticated with check (true);
create policy documents_authenticated_select on documents for select to authenticated using (true);
create policy documents_authenticated_update on documents for update to authenticated using (true);

grant select, insert, update, delete on documents to authenticated;

-- Storage bucket policy: authenticated users can upload/view their own applicant docs
-- Managed via Supabase dashboard: create "orp-documents" bucket with public read, authenticated write
