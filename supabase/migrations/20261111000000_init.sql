-- Emberframe data model (Supabase / Postgres).
--
-- One person has many projects. A project is one video being made: its library, its cut,
-- its conversations with Ember, its boards, its renders. Starting a new chat keeps the
-- project; starting a new project starts from nothing.
--
--   auth.users 1─1 profiles
--   profiles   1─n avatars         the person's own creators (faces they have the rights to)
--   profiles   1─n projects
--   projects   1─n assets          library files           assets 1─1 asset_analysis
--   projects   1─n clips           the cut (video and audio tracks), each clip uses one asset
--   projects   1─n captions
--   projects   1─n project_versions   earlier states of the cut, append only
--   projects   1─n chats 1─n messages          chats 1─1 chat_state (the model's own transcript)
--   projects   1─n boards          the node canvas from the Create step
--   projects   1─n shop_searches   what a Shop search returned
--   projects   1─n jobs            anything that costs GPU time or money
--   projects   1─n exports 1─n posts
--   profiles   1─1 subscriptions,  1─n ledger (money and seconds, append only),  1─n memories
--
-- Rules the database itself holds, so no caller can skip them:
--   * every row a person can reach is theirs (row level security on every table)
--   * a clip can only use an asset from its own project
--   * the cut is saved in one transaction, and a save made from stale data is refused
--   * exports and posts always carry the AI-generated label
--   * money and render jobs are written by the server only; a person can read their own
--   * prices are not stored here: they live in config.js, the ledger records amounts

-- ------------------------------------------------------------------ helpers
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------------ people
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text check (display_name is null or length(display_name) between 1 and 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A profile appears the moment someone signs up, whichever way they sign in (password, Google).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  insert into public.subscriptions (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end $$;

create table public.subscriptions (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  plan          text not null default 'none' check (plan in ('none', 'creator', 'creator_pro')),
  status        text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  avatar_limit  integer not null default 1 check (avatar_limit >= 0),   -- set by the server from config.js when the plan changes
  period_start  timestamptz,
  period_end    timestamptz,
  provider      text,            -- which payment provider; none chosen yet
  provider_ref  text,
  updated_at    timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end > period_start)
);

create table public.avatars (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name                text not null check (length(name) between 1 and 80),
  image_path          text not null unique,          -- object in the private 'media' bucket
  voice_ref           text,                          -- a voice from the voice library, if one is chosen for them
  rights_confirmed_at timestamptz not null default now(),   -- the person said this face is theirs to use
  created_at          timestamptz not null default now()
);
create index avatars_owner_idx on public.avatars (owner_id);

-- A plan allows a number of avatars. Checked here so two tabs cannot both add "the last one".
create function public.check_avatar_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allowed integer; have integer;
begin
  select avatar_limit into allowed from public.subscriptions where owner_id = new.owner_id for update;
  select count(*) into have from public.avatars where owner_id = new.owner_id;
  if have >= coalesce(allowed, 1) then
    raise exception 'Your plan allows % avatar(s).', coalesce(allowed, 1) using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger avatars_limit before insert on public.avatars for each row execute function public.check_avatar_limit();

create table public.memories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  note       text not null check (length(note) between 1 and 300),
  created_at timestamptz not null default now()
);
create index memories_owner_idx on public.memories (owner_id, created_at);

-- ------------------------------------------------------------------ projects
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null default 'Untitled cut' check (length(name) between 1 and 80),
  aspect      text not null default '9:16' check (aspect in ('9:16', '16:9', '1:1')),
  avatar_id   uuid references public.avatars (id) on delete set null,
  revision    integer not null default 0 check (revision >= 0),   -- goes up with every save of the cut
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc) where archived_at is null;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- Every row under a project carries its owner, copied from the project by this trigger and never
-- taken from the caller. That keeps the security rules a single cheap comparison.
create function public.set_owner_from_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select owner_id into new.owner_id from public.projects where id = new.project_id;
  if new.owner_id is null then
    raise exception 'No such project.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ library
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('video', 'image', 'audio')),
  source        text not null check (source in ('upload', 'generated', 'shop', 'edited', 'voice', 'product')),
  name          text not null check (length(name) between 1 and 120),
  storage_path  text not null unique,                 -- object in the private 'media' bucket
  poster_path   text,
  wave_path     text,
  duration_s    numeric(9,3) not null default 0 check (duration_s >= 0),
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  has_audio     boolean not null default false,
  is_reference  boolean not null default false,       -- another creator's video: for structure only, never exported
  ai_generated  boolean not null default false,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (id, project_id),                            -- lets a clip prove its asset is in the same project
  check (not (is_reference and ai_generated))
);
create index assets_project_idx on public.assets (project_id, created_at desc);
create index assets_owner_idx on public.assets (owner_id);
create trigger assets_owner before insert on public.assets for each row execute function public.set_owner_from_project();

-- What the studio has measured about a file. One row per asset, written by the server.
create table public.asset_analysis (
  asset_id    uuid primary key references public.assets (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  transcript  jsonb,              -- sentences with times
  words       jsonb,              -- every word with its own start and end
  quiet       jsonb,              -- stretches of silence
  loudness_db numeric(6,2),
  analysed_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ the cut
create table public.clips (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  track      text not null check (track in ('video', 'audio')),
  asset_id   uuid not null,
  position   integer check (position is null or position >= 0),         -- order on the video track
  start_s    numeric(9,3) check (start_s is null or start_s >= 0),      -- where a clip on the audio track begins
  in_s       numeric(9,3) not null default 0 check (in_s >= 0),         -- the part of the file that is used
  out_s      numeric(9,3) not null,
  volume     numeric(4,2) not null default 1 check (volume between 0 and 2),
  check (out_s > in_s),
  check ((track = 'video' and position is not null) or (track = 'audio' and start_s is not null)),
  foreign key (asset_id, project_id) references public.assets (id, project_id) on delete cascade,
  unique (project_id, track, position) deferrable initially deferred
);
create index clips_project_idx on public.clips (project_id);
create index clips_asset_idx on public.clips (asset_id);
create trigger clips_owner before insert on public.clips for each row execute function public.set_owner_from_project();

create table public.captions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  start_s    numeric(9,3) not null check (start_s >= 0),
  end_s      numeric(9,3) not null,
  body       text not null check (length(body) between 1 and 300),
  check (end_s > start_s)
);
create index captions_project_idx on public.captions (project_id, start_s);
create trigger captions_owner before insert on public.captions for each row execute function public.set_owner_from_project();

-- Earlier states of the cut. Rows are only ever added.
create table public.project_versions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  revision   integer not null,
  label      text not null default 'Edited by hand' check (length(label) <= 120),
  made_by    text not null default 'user' check (made_by in ('user', 'ember', 'system')),
  snapshot   jsonb not null,                           -- name, aspect, clips, captions as they were
  created_at timestamptz not null default now()
);
create index project_versions_idx on public.project_versions (project_id, created_at desc);
create trigger project_versions_owner before insert on public.project_versions for each row execute function public.set_owner_from_project();

-- ------------------------------------------------------------------ Ember
-- A project has many chats: a clean conversation about the same video is a new chat, not a new project.
create table public.chats (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null default 'New chat' check (length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index chats_project_idx on public.chats (project_id, updated_at desc);
create trigger chats_owner before insert on public.chats for each row execute function public.set_owner_from_project();
create trigger chats_touch before update on public.chats for each row execute function public.touch_updated_at();

-- What the person sees in the chat panel.
create table public.messages (
  id         bigint generated always as identity primary key,
  chat_id    uuid not null references public.chats (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('user', 'ember')),
  body       text not null default '',
  steps      jsonb not null default '[]'::jsonb,       -- what Ember did in that turn
  created_at timestamptz not null default now()
);
create index messages_chat_idx on public.messages (chat_id, id);
create function public.set_owner_from_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select owner_id into new.owner_id from public.chats where id = new.chat_id;
  if new.owner_id is null then
    raise exception 'No such chat.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger messages_owner before insert on public.messages for each row execute function public.set_owner_from_chat();

-- What the model itself needs to carry on a chat (tool calls, results, its reasoning tokens).
-- Never sent to a browser: there are no policies on this table, so only the server reads it.
create table public.chat_state (
  chat_id    uuid primary key references public.chats (id) on delete cascade,
  provider   text not null check (provider in ('claude', 'openai')),
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- The node canvas from the Create step.
create table public.boards (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default 'Board' check (length(name) between 1 and 80),
  graph      jsonb not null default '{}'::jsonb,       -- nodes, wires, view
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_project_idx on public.boards (project_id);
create trigger boards_owner before insert on public.boards for each row execute function public.set_owner_from_project();
create trigger boards_touch before update on public.boards for each row execute function public.touch_updated_at();

-- What a Shop search returned. Shop data is the owner's to licence, so it is private per person like everything else.
create table public.shop_searches (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  sort       text not null check (sort in ('top', 'latest', 'trending')),
  query      text,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index shop_searches_project_idx on public.shop_searches (project_id, created_at desc);
create trigger shop_searches_owner before insert on public.shop_searches for each row execute function public.set_owner_from_project();

-- ------------------------------------------------------------------ work that costs something
-- One row for each thing the render machine or a paid service is asked to do. Written by the server.
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  kind            text not null check (kind in ('clip', 'picture', 'voice', 'export')),
  status          text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  request         jsonb not null default '{}'::jsonb,  -- the brief, the length, which pictures it works from
  seconds         numeric(6,2) check (seconds is null or seconds > 0),
  approved_cents  integer not null default 0 check (approved_cents >= 0),   -- the price on the button the person pressed
  cost_cents      integer not null default 0 check (cost_cents >= 0),
  result_asset_id uuid references public.assets (id) on delete set null,
  error           text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  check (cost_cents <= approved_cents),                -- nothing is ever charged above what was agreed
  check (status not in ('done', 'failed', 'cancelled') or finished_at is not null)
);
create index jobs_project_idx on public.jobs (project_id, created_at desc);
create index jobs_owner_idx on public.jobs (owner_id);
create index jobs_queue_idx on public.jobs (created_at) where status in ('queued', 'running');   -- what the GPU watcher reads: empty means stop the card
create trigger jobs_owner before insert on public.jobs for each row execute function public.set_owner_from_project();

create table public.exports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  duration_s   numeric(9,3) not null check (duration_s > 0),
  size_bytes   bigint not null check (size_bytes > 0),
  ai_label     boolean not null default true check (ai_label),   -- the label is written into the file; a row without it cannot exist
  created_at   timestamptz not null default now()
);
create index exports_project_idx on public.exports (project_id, created_at desc);
create trigger exports_owner before insert on public.exports for each row execute function public.set_owner_from_project();

create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  export_id    uuid references public.exports (id) on delete set null,
  caption      text not null default '' check (length(caption) <= 2200),
  hashtags     text[] not null default '{}',
  mode         text not null default 'manual' check (mode in ('manual', 'auto')),
  status       text not null default 'draft' check (status in ('draft', 'queued', 'posted', 'failed')),
  disclosure   boolean not null default true check (disclosure),   -- posted as AI-generated, always
  scheduled_at timestamptz,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index posts_project_idx on public.posts (project_id, created_at desc);
create trigger posts_owner before insert on public.posts for each row execute function public.set_owner_from_project();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- Money and included seconds. Rows are only ever added; a balance is the sum.
create table public.ledger (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('topup', 'plan_grant', 'render', 'refund', 'adjust')),
  cents      integer not null default 0,                -- plus adds to the prepaid balance, minus spends it
  seconds    numeric(8,2) not null default 0,           -- plus adds included video seconds, minus uses them
  job_id     uuid references public.jobs (id) on delete set null,
  note       text,
  created_at timestamptz not null default now(),
  check (cents <> 0 or seconds <> 0)
);
create index ledger_owner_idx on public.ledger (owner_id, created_at desc);
create unique index ledger_one_charge_per_job on public.ledger (job_id) where kind = 'render';   -- a job is charged once

create view public.balances with (security_invoker = true) as
  select owner_id, coalesce(sum(cents), 0)::bigint as cents, coalesce(sum(seconds), 0)::numeric(10,2) as seconds
  from public.ledger group by owner_id;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ saving the cut
-- The whole cut is replaced in one transaction. The caller says which revision it started from;
-- if someone (another tab, Ember) saved since, nothing is written and the caller reloads.
create function public.save_timeline(p_project uuid, p_revision integer, p_clips jsonb, p_captions jsonb,
                                     p_label text default null, p_made_by text default 'user')
returns integer language plpgsql set search_path = '' as $$
declare v integer;
begin
  update public.projects set revision = revision + 1
   where id = p_project and revision = p_revision
  returning revision into v;
  if v is null then
    raise exception 'The cut changed since you loaded it.' using errcode = 'serialization_failure';
  end if;
  delete from public.clips where project_id = p_project;
  delete from public.captions where project_id = p_project;
  insert into public.clips (id, project_id, track, asset_id, position, start_s, in_s, out_s, volume)
  select coalesce(c.id, gen_random_uuid()), p_project, c.track, c.asset_id, c.position, c.start_s, coalesce(c.in_s, 0), c.out_s, coalesce(c.volume, 1)
    from jsonb_to_recordset(coalesce(p_clips, '[]'::jsonb))
         as c (id uuid, track text, asset_id uuid, position integer, start_s numeric, in_s numeric, out_s numeric, volume numeric);
  insert into public.captions (id, project_id, start_s, end_s, body)
  select coalesce(t.id, gen_random_uuid()), p_project, t.start_s, t.end_s, t.body
    from jsonb_to_recordset(coalesce(p_captions, '[]'::jsonb)) as t (id uuid, start_s numeric, end_s numeric, body text);
  if p_label is not null then
    insert into public.project_versions (project_id, revision, label, made_by, snapshot)
    select p.id, v, left(p_label, 120), p_made_by,
           jsonb_build_object('name', p.name, 'aspect', p.aspect, 'clips', coalesce(p_clips, '[]'::jsonb), 'captions', coalesce(p_captions, '[]'::jsonb))
      from public.projects p where p.id = p_project;
  end if;
  return v;
end $$;

-- A new project starts from nothing: an empty cut, one chat, one board.
create function public.new_project(p_name text default 'Untitled cut') returns uuid
language plpgsql set search_path = '' as $$
declare v uuid;
begin
  insert into public.projects (name) values (coalesce(nullif(trim(p_name), ''), 'Untitled cut')) returning id into v;
  insert into public.chats (project_id) values (v);
  insert into public.boards (project_id) values (v);
  return v;
end $$;

-- ------------------------------------------------------------------ who may do what
-- Nobody who is not signed in can touch anything. A signed-in person gets exactly the verbs listed
-- here, and row level security below narrows those to their own rows. The server (service role)
-- is the only writer of money, jobs, exports, analysis and the model's transcript.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select on public.subscriptions, public.asset_analysis, public.jobs, public.exports, public.ledger, public.balances,
                public.project_versions, public.messages, public.shop_searches, public.assets to authenticated;
grant insert on public.project_versions to authenticated;                               -- through save_timeline
grant select, insert, delete on public.avatars, public.memories to authenticated;
grant select, insert, update (name, aspect, avatar_id, archived_at, revision), delete on public.projects to authenticated;
grant select, insert, update, delete on public.clips, public.captions to authenticated;  -- through save_timeline
grant select, insert, update (title, archived_at), delete on public.chats to authenticated;
grant select, insert, update (name, graph), delete on public.boards to authenticated;
grant select, insert, update (caption, hashtags, mode, export_id, scheduled_at), delete on public.posts to authenticated;
grant update (name), delete on public.assets to authenticated;
grant execute on function public.save_timeline(uuid, integer, jsonb, jsonb, text, text), public.new_project(text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'subscriptions', 'avatars', 'memories', 'projects', 'assets', 'asset_analysis', 'clips', 'captions',
                           'project_versions', 'chats', 'messages', 'chat_state', 'boards', 'shop_searches', 'jobs', 'exports', 'posts', 'ledger']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- "theirs": one rule for every table that carries owner_id, for every verb the grants above allow.
  foreach t in array array['subscriptions', 'avatars', 'memories', 'projects', 'assets', 'asset_analysis', 'clips', 'captions',
                           'project_versions', 'chats', 'messages', 'boards', 'shop_searches', 'jobs', 'exports', 'posts', 'ledger']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_own', t);
  end loop;
end $$;
create policy profiles_own on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- chat_state has no policy on purpose: with row level security on, that means no browser can read or write it.
