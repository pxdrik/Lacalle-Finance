-- Reforço (supabase-schema-v2-hardening.sql, commit 4e6792c). Conferido em
-- produção em 05/10/2026.

-- O JSON tem que ser um objeto (o app sempre grava um).
alter table public.user_data
  add constraint user_data_is_object
  check (jsonb_typeof(data) = 'object');

-- Teto de tamanho. pg_column_size mede o tamanho guardado (comprimido), então
-- o JSON de verdade pode ser maior que isto; serve de freio, não de régua.
alter table public.user_data
  add constraint user_data_size_limit
  check (pg_column_size(data) < 5 * 1024 * 1024);

-- Ninguém além do banco precisa esvaziar a tabela, referenciá-la ou criar
-- gatilho nela.
revoke truncate, references, trigger on public.user_data from anon, authenticated;
