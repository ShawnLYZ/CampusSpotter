-- helper functions (read profiles.role for auth.uid())
create or replace function app_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() $$;
create or replace function is_manager() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'manager', false) $$;
create or replace function is_demo() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'demo', false) $$;
revoke execute on function app_role(), is_manager(), is_demo() from public, anon;
grant execute on function app_role(), is_manager(), is_demo() to authenticated;

-- profile row created for every new auth user
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'role', 'demo'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.sources enable row level security;
create policy "sources_read" on public.sources for select to authenticated using (true);
alter table public.disruptions enable row level security;
create policy "disruptions_read" on public.disruptions for select to authenticated using (true);
alter table public.disruption_sources enable row level security;
create policy "disruption_sources_read" on public.disruption_sources for select to authenticated using (true);
alter table public.baseline_values enable row level security;
create policy "baseline_values_read" on public.baseline_values for select to authenticated using (true);
alter table public.settings enable row level security;
create policy "settings_read" on public.settings for select to authenticated using (true);
alter table public.rooms enable row level security;
create policy "rooms_read" on public.rooms for select to authenticated using (true);
alter table public.cafeteria_outlets enable row level security;
create policy "cafeteria_outlets_read" on public.cafeteria_outlets for select to authenticated using (true);
alter table public.energy_profiles enable row level security;
create policy "energy_profiles_read" on public.energy_profiles for select to authenticated using (true);
alter table public.waiting_halls enable row level security;
create policy "waiting_halls_read" on public.waiting_halls for select to authenticated using (true);
alter table public.shuttle_timetable enable row level security;
create policy "shuttle_timetable_read" on public.shuttle_timetable for select to authenticated using (true);
alter table public.forecasts enable row level security;
create policy "forecasts_read" on public.forecasts for select to authenticated using (true);
alter table public.plans enable row level security;
create policy "plans_read" on public.plans for select to authenticated using (true);
alter table public.decisions enable row level security;
create policy "decisions_read" on public.decisions for select to authenticated using (true);
alter table public.checklist_items enable row level security;
create policy "checklist_items_read" on public.checklist_items for select to authenticated using (true);
alter table public.announcements enable row level security;
create policy "announcements_read" on public.announcements for select to authenticated using (true);
alter table public.profiles enable row level security;
create policy "profiles_read" on public.profiles for select to authenticated using (true);
alter table public.job_runs enable row level security;
create policy "job_runs_read" on public.job_runs for select to authenticated using (true);
alter table public.api_usage enable row level security;
create policy "api_usage_read" on public.api_usage for select to authenticated using (true);
alter table public.timetable_days enable row level security;
create policy "timetable_days_read" on public.timetable_days for select to authenticated using (true);
alter table public.timetable_groups enable row level security;
create policy "timetable_groups_read" on public.timetable_groups for select to authenticated using (true);
alter table public.timetable_conditioned enable row level security;
create policy "timetable_conditioned_read" on public.timetable_conditioned for select to authenticated using (true);
alter table public.prayer_times enable row level security;
create policy "prayer_times_read" on public.prayer_times for select to authenticated using (true);
alter table public.weather_hourly enable row level security;
create policy "weather_hourly_read" on public.weather_hourly for select to authenticated using (true);
alter table public.traffic_cache enable row level security;
create policy "traffic_cache_read" on public.traffic_cache for select to authenticated using (true);
alter table public.lrt_ridership_daily enable row level security;
create policy "lrt_ridership_daily_read" on public.lrt_ridership_daily for select to authenticated using (true);
alter table public.ai_estimates enable row level security;
create policy "ai_estimates_read" on public.ai_estimates for select to authenticated using (true);
alter table public.ai_cache enable row level security;
create policy "ai_cache_read" on public.ai_cache for select to authenticated using (true);
create policy "sources_write" on public.sources for all to authenticated using (is_manager()) with check (is_manager());
create policy "disruptions_write" on public.disruptions for all to authenticated using (is_manager()) with check (is_manager());
create policy "disruption_sources_write" on public.disruption_sources for all to authenticated using (is_manager()) with check (is_manager());
create policy "baseline_values_write" on public.baseline_values for all to authenticated using (is_manager()) with check (is_manager());
create policy "settings_write" on public.settings for all to authenticated using (is_manager()) with check (is_manager());
create policy "rooms_write" on public.rooms for all to authenticated using (is_manager()) with check (is_manager());
create policy "cafeteria_outlets_write" on public.cafeteria_outlets for all to authenticated using (is_manager()) with check (is_manager());
create policy "energy_profiles_write" on public.energy_profiles for all to authenticated using (is_manager()) with check (is_manager());
create policy "waiting_halls_write" on public.waiting_halls for all to authenticated using (is_manager()) with check (is_manager());
create policy "shuttle_timetable_write" on public.shuttle_timetable for all to authenticated using (is_manager()) with check (is_manager());
create policy "forecasts_write" on public.forecasts for all to authenticated using (is_manager() or is_demo()) with check (is_manager() or is_demo());
create policy "plans_write" on public.plans for all to authenticated using (is_manager() or is_demo()) with check (is_manager() or is_demo());
create policy "decisions_write" on public.decisions for all to authenticated using (is_manager() or is_demo()) with check (is_manager() or is_demo());
create policy "checklist_items_write" on public.checklist_items for all to authenticated using (is_manager() or is_demo()) with check (is_manager() or is_demo());
create policy "announcements_write" on public.announcements for all to authenticated using (is_manager() or is_demo()) with check (is_manager() or is_demo());
