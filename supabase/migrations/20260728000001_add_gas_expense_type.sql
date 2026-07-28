DO $$
begin
  alter type public.expense_type add value 'gas';
exception
  when duplicate_object then null;
end $$;
