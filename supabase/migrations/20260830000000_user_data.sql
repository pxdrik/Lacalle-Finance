-- Esquema base do LaCalle Finance: uma linha por pessoa, com todos os dados
-- num JSON (ver src/lib/storage.js e src/lib/sync.js).
--
-- Até 05/10/2026 este SQL era colado à mão no SQL Editor (supabase-schema.sql,
-- na raiz). Esta pasta passa a ser a fonte: os testes de banco (PGlite,
-- src/lib/rls.db.test.js) aplicam estes arquivos em ordem, e o que está aqui
-- foi conferido contra o banco de produção em 05/10/2026, inclusive os nomes
-- das políticas (sem acento em produção).

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Usuarios so leem seus proprios dados"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Usuarios so criam sua propria linha"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Usuarios so atualizam seus proprios dados"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuarios so apagam seus proprios dados"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- updated_at é a "versão" usada na trava de concorrência (storage.set:
-- UPDATE ... WHERE updated_at = versão esperada). Só o banco escreve.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();
