-- Kate conversation persistence — backs the stateful Kate-state inference
-- layer. One conversation per user is "active" at a time; new days /
-- abandoned threads start fresh ones.
--
-- Schema design notes:
--   * kate_conversations is the parent. We keep a status enum so we
--     can archive without deleting (auditable history).
--   * kate_messages is the turn-by-turn log. Each row is either Kate
--     speaking, the user replying, or a system note (e.g. "user
--     dismissed item Dr. Smith").
--   * items_referenced + chips_offered are JSONB so we can evolve the
--     KateItem / KateChip shape without migrations.
--   * Indexes prioritize the two hot queries: "find this user's active
--     conversation" and "fetch the last N messages of a conversation."

create table if not exists public.kate_conversations (
  id            uuid primary key default gen_random_uuid(),
  app_user_id   uuid not null references public.app_users(id) on delete cascade,
  status        text not null default 'active'
                 check (status in ('active', 'archived')),
  started_at    timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  -- Cached snapshot of the rule layer's last KateFacts, so a refresh
  -- can compare against it for dedup without re-querying the world.
  last_facts_json jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists kate_conversations_active_user_idx
  on public.kate_conversations (app_user_id, status, last_activity_at desc);

create table if not exists public.kate_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.kate_conversations(id) on delete cascade,
  app_user_id     uuid not null references public.app_users(id) on delete cascade,
  role            text not null check (role in ('kate', 'user', 'system')),
  content         text not null,
  -- Items Kate referenced in this message (so future turns can dedup
  -- against what's already been pitched, and the UI can attach
  -- per-item actions to the chips).
  items_referenced jsonb not null default '[]'::jsonb,
  -- Response chips offered to the user on this turn (only meaningful
  -- when role='kate').
  chips_offered    jsonb not null default '[]'::jsonb,
  -- When the user replied, which chip intent did they pick? null for
  -- free-form typed replies (in which case content is the typed text).
  user_chip_intent text,
  -- Bucket and tone Kate was in when she said this — useful for
  -- replaying her state without recomputing.
  kate_bucket      text,
  kate_tone        text,
  -- Confidence band at time of generation (new / settled / established)
  kate_confidence  text,
  created_at       timestamptz not null default now()
);

create index if not exists kate_messages_conversation_idx
  on public.kate_messages (conversation_id, created_at);

create index if not exists kate_messages_user_recent_idx
  on public.kate_messages (app_user_id, created_at desc);

-- RLS: this table contains user-conversation history. Same posture as
-- providers / proposals — service role for writes, user-scoped reads.
alter table public.kate_conversations enable row level security;
alter table public.kate_messages       enable row level security;

drop policy if exists kate_conversations_owner on public.kate_conversations;
create policy kate_conversations_owner
  on public.kate_conversations
  for select using (
    app_user_id in (
      select id from public.app_users where auth_user_id = auth.uid()
    )
  );

drop policy if exists kate_messages_owner on public.kate_messages;
create policy kate_messages_owner
  on public.kate_messages
  for select using (
    app_user_id in (
      select id from public.app_users where auth_user_id = auth.uid()
    )
  );
