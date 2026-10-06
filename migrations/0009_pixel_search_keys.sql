alter table pixel_ai_keys
  drop constraint if exists pixel_ai_keys_provider_check;

alter table pixel_ai_keys
  add constraint pixel_ai_keys_provider_check
  check (provider in ('gemini', 'groq', 'openrouter', 'tavily', 'jina'));
