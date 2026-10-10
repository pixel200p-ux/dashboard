create table if not exists shared_notes (
  id text primary key,
  title text not null default '',
  content text not null default '',
  color text not null default 'slate'
    check (color in ('slate', 'blue', 'amber', 'rose', 'green', 'violet')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_notes_pinned_updated_idx
  on shared_notes (pinned desc, updated_at desc);
