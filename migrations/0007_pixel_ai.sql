create table if not exists pixel_ai_keys (
  id text primary key,
  user_id text not null,
  provider text not null check (provider in ('gemini', 'groq', 'openrouter')),
  name text not null,
  key_ciphertext text not null,
  key_nonce text not null,
  key_auth_tag text not null,
  status text not null default 'untested' check (status in ('untested', 'active', 'inactive')),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pixel_ai_keys_user_idx on pixel_ai_keys (user_id, created_at);

create table if not exists pixel_preferences (
  user_id text primary key,
  mandatory_rules text not null default '',
  memories text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists pixel_conversations (
  id text not null,
  user_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create index if not exists pixel_conversations_user_updated_idx
  on pixel_conversations (user_id, updated_at desc);

create table if not exists pixel_messages (
  id text primary key,
  conversation_id text not null,
  user_id text not null,
  role text not null check (role in ('user', 'pixel')),
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references pixel_conversations (id, user_id) on delete cascade
);

create index if not exists pixel_messages_conversation_created_idx
  on pixel_messages (conversation_id, user_id, created_at);
