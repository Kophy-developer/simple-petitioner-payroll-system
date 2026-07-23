alter table public.priced_petition_lines
  add column if not exists official_number text,
  add column if not exists official_name text,
  add column if not exists ontarget_name text,
  add column if not exists client_report_name text;
