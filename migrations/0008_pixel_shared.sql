update pixel_ai_keys
set user_id = 'shared';

create temporary table pixel_conversation_migration on commit drop as
select
  id as old_id,
  user_id as old_user_id,
  case
    when count(*) over (partition by id) > 1
      then id || '-' || substr(md5(user_id || id), 1, 16)
    else id
  end as new_id
from pixel_conversations;

alter table pixel_messages
  drop constraint pixel_messages_conversation_id_user_id_fkey;

update pixel_messages as message
set conversation_id = migration.new_id,
    user_id = 'shared'
from pixel_conversation_migration as migration
where message.conversation_id = migration.old_id
  and message.user_id = migration.old_user_id;

update pixel_conversations as conversation
set id = migration.new_id,
    user_id = 'shared'
from pixel_conversation_migration as migration
where conversation.id = migration.old_id
  and conversation.user_id = migration.old_user_id;

alter table pixel_messages
  add constraint pixel_messages_conversation_id_user_id_fkey
  foreign key (conversation_id, user_id)
  references pixel_conversations (id, user_id) on delete cascade;

insert into pixel_preferences (user_id, mandatory_rules, memories)
select
  'shared',
  left(coalesce((
    select string_agg(value, E'\n')
    from (
      select distinct trim(mandatory_rules) as value
      from pixel_preferences
      where trim(mandatory_rules) <> ''
      order by value
    ) as rules
  ), ''), 12000),
  left(coalesce((
    select string_agg(value, E'\n')
    from (
      select distinct trim(memories) as value
      from pixel_preferences
      where trim(memories) <> ''
      order by value
    ) as saved_memories
  ), ''), 12000)
where exists (select 1 from pixel_preferences)
on conflict (user_id) do update set
  mandatory_rules = excluded.mandatory_rules,
  memories = excluded.memories,
  updated_at = now();

delete from pixel_preferences where user_id <> 'shared';
