-- all in schema public
create table profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null,
  role text not null default 'demo' check (role in ('manager','demo')), created_at timestamptz not null default now());
create table sources (id text primary key, name text not null, label text not null check (label in ('verified','baseline','ai')),
  url text, licence text not null, job_name text, expected_interval_h numeric, description text not null);
create table disruptions (id text primary key, title text not null,
  type text not null check (type in ('stadium_event','apu_calendar','weekly_pattern','weather','manual')),
  kind text not null check (kind in ('concert','sports','intake','holiday','break','friday_prayer','heavy_rain','other')),
  venue text, start_at timestamptz not null, end_at timestamptz not null, check (end_at > start_at),
  expected_attendance integer check (expected_attendance >= 0), attendance_label text check (attendance_label in ('verified','baseline','ai')),
  origin text not null check (origin in ('scan','manual','rule')),
  override_start_at timestamptz, override_end_at timestamptz, override_attendance integer,
  overridden_by uuid references profiles(id), overridden_at timestamptz,
  status text not null default 'active' check (status in ('active','dismissed')),
  risk_level text check (risk_level in ('low','medium','high','critical')), risk_reason text, risk_peaks jsonb, risk_computed_at timestamptz,
  notes text, dedupe_key text unique, created_by uuid references profiles(id), updated_at timestamptz not null default now());
create index disruptions_start_idx on disruptions (start_at);
create table disruption_sources (disruption_id text not null references disruptions(id) on delete cascade, url text not null,
  title text, published_at timestamptz, fetched_at timestamptz not null default now(), primary key (disruption_id, url));
create table job_runs (id bigint generated always as identity primary key, job_name text not null, started_at timestamptz not null default now(),
  finished_at timestamptz, status text not null check (status in ('running','success','failed')), method text,
  items_found integer not null default 0, items_changed integer not null default 0, error_summary text);
create index job_runs_job_idx on job_runs (job_name, started_at desc);
create table baseline_values (key text primary key, value jsonb not null, unit text not null, label text not null check (label in ('verified','baseline','ai')),
  description text not null, source_id text not null, updated_at timestamptz not null default now(), updated_by uuid references profiles(id));
create table settings (id integer primary key check (id = 1), value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references profiles(id));
create table rooms (code text primary key, block text not null check (block in ('A','B','C','D','E','S','L','U')), level text,
  room_type text not null check (room_type in ('classroom','lab','auditorium')), seats integer not null check (seats between 1 and 1000),
  seats_label text not null default 'baseline' check (seats_label in ('verified','baseline','ai')));
create table cafeteria_outlets (id text primary key, name text not null, zone text not null, counters integer not null, service_rate_per_counter_15min numeric not null,
  opens_min integer not null, closes_min integer not null, staff integer not null, diner_share numeric not null, label text not null default 'baseline');
create table energy_profiles (block text primary key check (block in ('A','B','C','D','E','S','L','U')), base_load_kw numeric not null,
  occupied_room_kw numeric not null, idle_room_kw numeric not null, label text not null default 'baseline');
create table waiting_halls (id text primary key, name text not null, block text not null, capacity integer not null, load_kw numeric not null, label text not null default 'baseline');
create table shuttle_timetable (service text not null check (service in ('normal','reduced')), direction text not null check (direction in ('apu_to_lrt','lrt_to_apu','loop')),
  departure_min integer not null, loop_to_min integer, limited_seats boolean not null default false, label text not null, source_id text not null,
  effective_from date not null, primary key (service, direction, departure_min));
create table timetable_days (date date primary key, sessions integer not null, label text not null default 'verified', synced_at timestamptz not null);
create table timetable_groups (date date not null, block text not null, room_type text not null, start_min integer not null, end_min integer not null,
  count integer not null, first_of_day_share numeric not null, last_of_day_share numeric not null, primary key (date, block, room_type, start_min, end_min));
create table timetable_conditioned (date date not null, block text not null, room_type text not null, step integer not null check (step between 0 and 75),
  rooms integer not null, primary key (date, block, room_type, step));
create table prayer_times (date date not null, zone text not null, fajr_min integer not null, dhuhr_min integer not null, asr_min integer not null,
  maghrib_min integer not null, isha_min integer not null, fetched_at timestamptz not null, primary key (date, zone));
create table weather_hourly (time timestamptz primary key, precipitation_mm numeric, precipitation_probability integer, fetched_at timestamptz not null);
create table traffic_cache (date date not null, hour_index integer not null check (hour_index between 0 and 19),
  direction text not null check (direction in ('apu_to_lrt','lrt_to_apu')), kind text not null default 'google' check (kind in ('google','reconstructed')),
  duration_s integer not null, static_duration_s integer not null, fetched_at timestamptz not null, primary key (date, hour_index, direction, kind));
create table api_usage (service text not null, month text not null, count integer not null default 0, primary key (service, month));
create table lrt_ridership_daily (date date not null, station text not null, boardings integer not null, alightings integer not null, primary key (date, station));
create table ai_estimates (id bigint generated always as identity primary key, context_hash text not null,
  disruption_id text not null references disruptions(id) on delete cascade, date date not null, key text not null,
  likely jsonb not null, low jsonb not null, high jsonb not null, unit text not null, reasoning text not null,
  confidence text not null check (confidence in ('low','medium','high')), model text not null, clamped boolean not null default false,
  created_at timestamptz not null default now(), unique (context_hash, key));
create table ai_cache (request_hash text primary key, function text not null, response jsonb not null, created_at timestamptz not null default now());
create table forecasts (id uuid primary key default gen_random_uuid(), context_date date not null, disruption_id text,
  scenario_kind text not null check (scenario_kind in ('no_action','plan')), levers jsonb not null, summary jsonb not null, per_step jsonb not null,
  input_snapshot_hash text not null, engine_version text not null, created_by uuid references profiles(id) default auth.uid(), created_at timestamptz not null default now());
create table plans (id uuid primary key default gen_random_uuid(), context_date date not null, disruption_id text, name text not null, levers jsonb not null,
  rationale text not null, cost_lines jsonb not null, total_cost_rm numeric not null, summary jsonb not null, no_action_summary jsonb not null,
  budget_rm numeric not null, over_budget boolean not null, generated_at timestamptz not null default now(), created_by uuid references profiles(id) default auth.uid());
create table decisions (id uuid primary key default gen_random_uuid(), plan_id uuid references plans(id), forecast_id uuid references forecasts(id),
  disruption_id text, context_date date not null, plan_name text not null, levers jsonb not null, predicted jsonb not null, total_cost_rm numeric not null,
  decided_by uuid references profiles(id) default auth.uid(), decided_at timestamptz not null default now(),
  status text not null default 'planned' check (status in ('planned','done','cancelled')), notes text);
create table checklist_items (id uuid primary key default gen_random_uuid(), decision_id uuid not null references decisions(id) on delete cascade,
  team text not null check (team in ('transport','facilities','cafeteria','academic')), text text not null, due_at timestamptz, sort integer not null default 0,
  done boolean not null default false, done_by uuid references profiles(id), done_at timestamptz);
create table announcements (id uuid primary key default gen_random_uuid(), decision_id uuid not null unique references decisions(id) on delete cascade,
  draft text not null, edited_text text, updated_at timestamptz not null default now());
create or replace function increment_api_usage(p_service text, p_month text, p_n integer) returns integer
  language sql security definer set search_path = public as $$
  insert into api_usage (service, month, count) values (p_service, p_month, p_n)
  on conflict (service, month) do update set count = api_usage.count + excluded.count returning count $$;
revoke execute on function increment_api_usage(text, text, integer) from public, anon, authenticated;
