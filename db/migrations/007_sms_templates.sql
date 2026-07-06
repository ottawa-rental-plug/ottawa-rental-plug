-- Phase 4: SMS templates and logging

create table if not exists sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text, -- screening, approved, scheduled, manual, etc
  message text not null,
  placeholder_name boolean default true, -- include {{name}} in template
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicants(id) on delete set null,
  to_phone text not null,
  message text not null,
  template_id uuid references sms_templates(id) on delete set null,
  status text default 'pending', -- pending, sent, failed
  twilio_sid text, -- Twilio message ID
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists sms_log_applicant_idx on sms_log(applicant_id);
create index if not exists sms_log_sent_at_idx on sms_log(sent_at);

alter table sms_templates enable row level security;
alter table sms_log enable row level security;

create policy sms_templates_admin_all on sms_templates for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);
create policy sms_log_admin_all on sms_log for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);

grant select, insert, update, delete on sms_templates to authenticated;
grant select, insert, update, delete on sms_log to authenticated;

-- Pre-seeded SMS templates
insert into sms_templates (name, trigger_type, message, placeholder_name)
values
  ('Screening Update', 'screening', 'Hi {{name}}, your application is under review. We''ll contact you within 24 hours. — Ottawa Rental Plug', true),
  ('Approval Notification', 'approved', 'Great news {{name}}! Your application has been approved. Check your email for next steps. — Ottawa Rental Plug', true),
  ('Viewing Scheduled', 'scheduled', 'Hi {{name}}, we have a viewing scheduled. Confirm here or reply STOP. — Ottawa Rental Plug', true),
  ('Follow-up', 'manual', 'Hi {{name}}, just checking in on your application. Any questions? — Ottawa Rental Plug', true)
on conflict do nothing;
