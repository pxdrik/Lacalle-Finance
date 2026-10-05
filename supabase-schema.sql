-- HISTÓRICO. A fonte do esquema agora é supabase/migrations/ (conferida contra
-- produção em 05/10/2026 e testada no PGlite: npm run test:db). Este arquivo
-- fica só como registro do que foi colado à mão no SQL Editor.

-- ============================================================================
-- LACALLE FINANCE — schema do Supabase
-- ============================================================================
-- Como usar: no painel do Supabase, vá em "SQL Editor" > "New query",
-- cole este arquivo inteiro e clique em "Run". Só precisa fazer isso uma vez.
--
-- Estratégia escolhida (e por quê):
-- Em vez de quebrar os dados em várias tabelas (uma pra transações, uma pra
-- desejos, etc.), guardamos tudo como um único JSON por usuário — exatamente
-- como já funciona hoje com o window.storage. Isso significa migrar o app
-- trocando muito pouca coisa de código (só a camada de armazenamento e o
-- login), sem reescrever a lógica toda. Se um dia o app crescer muito (tipo,
-- virar produto de verdade com muitos usuários e relatórios pesados), aí sim
-- vale a pena normalizar em tabelas separadas — mas isso é over-engineering
-- pra agora.
-- ============================================================================

-- Tabela: uma linha por usuário, com todos os dados dele num campo JSON.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Liga a segurança em nível de linha (Row Level Security). Sem isso, por
-- padrão o Supabase BLOQUEIA tudo — o RLS é o que permite que cada usuário
-- acesse exatamente (e só) a própria linha.
alter table public.user_data enable row level security;

-- Política: cada usuário só pode LER a própria linha.
create policy "Usuários só leem seus próprios dados"
  on public.user_data for select
  using (auth.uid() = user_id);

-- Política: cada usuário só pode CRIAR uma linha pra si mesmo.
create policy "Usuários só criam sua própria linha"
  on public.user_data for insert
  with check (auth.uid() = user_id);

-- Política: cada usuário só pode ATUALIZAR a própria linha.
create policy "Usuários só atualizam seus próprios dados"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Política: cada usuário só pode APAGAR a própria linha (usado em "apagar conta").
create policy "Usuários só apagam seus próprios dados"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- Atualiza "updated_at" sozinho toda vez que a linha é alterada — útil pra
-- detecção de conflito entre abas/dispositivos que o app já faz.
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

-- ============================================================================
-- Pronto. Depois de rodar isso, vá em Authentication > Providers e confirme
-- que "Email" está habilitado (vem habilitado por padrão).
-- ============================================================================
