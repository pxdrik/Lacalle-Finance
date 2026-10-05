-- Avisos do verificador de segurança do Supabase em 05/10/2026.

-- 1. Função do gatilho com search_path fixo: sem isto, quem conseguisse criar
--    um objeto num schema do caminho de busca poderia trocar o now() que a
--    função usa. Com search_path vazio, só pg_catalog é visto.
alter function public.set_updated_at() set search_path = '';

-- 2. rls_auto_enable() é a função do gatilho de evento "ensure_rls" (liga o
--    RLS em toda tabela nova do schema public). Ela roda como dona do banco
--    (security definer) e estava liberada para anon e authenticated via
--    /rest/v1/rpc. Por ser função de gatilho de evento, chamá-la fora do
--    gatilho já falha, mas não há motivo para expô-la. O gatilho continua
--    funcionando: quem dispara é o próprio banco, não esses papéis.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
