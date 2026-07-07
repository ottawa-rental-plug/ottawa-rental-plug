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

-- Admin can access all documents
create policy documents_admin_all on documents for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);

-- Users can only access documents for applicants they can see (via units they landlord)
create policy documents_owner_insert on documents for insert to authenticated with check (
  applicant_id in (
    select app.applicant_id
    from applications app
    join units u on u.id = app.unit_id
    where u.landlord_id = auth.uid()
  )
);

create policy documents_owner_select on documents for select to authenticated using (
  applicant_id in (
    select app.applicant_id
    from applications app
    join units u on u.id = app.unit_id
    where u.landlord_id = auth.uid()
  )
  or applicant_id in (
    select id from applicants where id = auth.uid()  -- applicants can view own docs
  )
);

create policy documents_owner_update on documents for update to authenticated using (
  applicant_id in (
    select app.applicant_id
    from applications app
    join units u on u.id = app.unit_id
    where u.landlord_id = auth.uid()
  )
);

grant select, insert, update, delete on documents to authenticated;

-- Storage bucket policy: authenticated users can upload/view their own applicant docs
-- Managed via Supabase dashboard: create "orp-documents" bucket with public read, authenticated write
