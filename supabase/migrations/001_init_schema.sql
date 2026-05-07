-- Convoy initial schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id           uuid references auth.users primary key,
  display_name text not null,
  avatar_color text not null default '#3B82F6',
  created_at   timestamptz default now()
);

create table if not exists trips (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid references profiles(id) on delete set null,
  share_token      text unique not null,
  destination_name text not null,
  destination_lat  float8 not null,
  destination_lng  float8 not null,
  route_data       jsonb,
  transport_mode   text not null default 'driving',
  avoid_tolls      boolean default false,
  status           text not null default 'lobby',
  created_at       timestamptz default now(),
  started_at       timestamptz,
  ended_at         timestamptz,
  constraint trips_status_check check (status in ('lobby', 'active', 'finished')),
  constraint trips_mode_check   check (transport_mode in ('driving', 'cycling', 'walking', 'motorcycling', 'running'))
);

create index if not exists trips_share_token_idx on trips(share_token);
create index if not exists trips_host_id_idx on trips(host_id);

create table if not exists participants (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid references trips(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete set null,
  guest_name   text,
  display_name text not null,
  color        text not null,
  joined_at    timestamptz default now(),
  finished_at  timestamptz,
  finish_rank  int,
  is_host      boolean default false,
  is_ghost     boolean default false
);

create index if not exists participants_trip_id_idx on participants(trip_id);
create unique index if not exists participants_trip_color_idx on participants(trip_id, color);

create table if not exists position_updates (
  participant_id uuid references participants(id) on delete cascade primary key,
  trip_id        uuid references trips(id) on delete cascade not null,
  lat            float8 not null,
  lng            float8 not null,
  heading        float4,
  speed_kmh      float4,
  updated_at     timestamptz default now()
);

create index if not exists position_updates_trip_id_idx on position_updates(trip_id);

create table if not exists position_logs (
  id             bigint generated always as identity primary key,
  participant_id uuid references participants(id) on delete cascade not null,
  trip_id        uuid references trips(id) on delete cascade not null,
  lat            float8 not null,
  lng            float8 not null,
  speed_kmh      float4,
  logged_at      timestamptz default now()
);

create index if not exists position_logs_trip_idx on position_logs(trip_id, logged_at);
create index if not exists position_logs_participant_idx on position_logs(participant_id, logged_at);

create table if not exists reactions (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid references trips(id) on delete cascade not null,
  participant_id uuid references participants(id) on delete cascade not null,
  reaction_type  text not null,
  created_at     timestamptz default now(),
  constraint reactions_type_check check (reaction_type in ('thumbsup', 'wait', 'pullover', 'horn'))
);

create index if not exists reactions_trip_idx on reactions(trip_id, created_at);
