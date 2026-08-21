-- ============================================================================
-- LACALLE FINANCE — hardening v2 (rodar DEPOIS do supabase-schema.sql)
-- ============================================================================
-- Como usar: no painel do Supabase, vá em "SQL Editor" > "New query", cole
-- este arquivo inteiro e clique em "Run". É seguro rodar mesmo com dados já
-- existentes na tabela (os CHECKs abaixo validam o que já está lá antes de
-- serem ativados; se algum dado hoje violar uma regra, o comando falha e
-- avisa qual — nada é apagado).
--
-- O que isso resolve: a tabela `user_data` guarda um blob JSON sem schema
-- (decisão consciente, ver supabase-schema.sql) — isso significa que HOJE o
-- banco aceita qualquer coisa dentro de `data` (valores absurdos, tipos
-- errados, payloads enormes), e toda a validação de regras financeiras
-- (valores negativos, limites, datas) vive só no frontend (src/lib/
-- validation.js). Isso não é uma falha de autorização — o RLS já garante que
-- cada usuário só pode fazer isso na PRÓPRIA linha, nunca na de outro — mas
-- é uma lacuna de integridade: alguém usando a API diretamente (sem passar
-- pela UI) pode gravar lixo na própria conta.
--
-- Este arquivo NÃO tenta validar cada regra de negócio (isso exigiria
-- reescrever a validação inteira em SQL toda vez que uma regra do app
-- mudasse — caro de manter para um JSON schema-less). Em vez disso, ele
-- adiciona uma rede de segurança mínima e barata de manter: o valor tem que
-- ser um objeto JSON de verdade, e não pode ultrapassar um tamanho razoável
-- (evita abuso/DoS por payload gigante). Se um dia o app crescer a ponto de
-- precisar de garantias mais fortes por campo, o caminho natural é
-- normalizar em tabelas de verdade (o próprio schema original já comenta
-- essa possibilidade).
-- ============================================================================

-- 1) `data` sempre precisa ser um objeto JSON (não um array, número, string
--    solta, etc.) — é o formato que o app sempre grava e sempre espera ler.
alter table public.user_data
  add constraint user_data_is_object
  check (jsonb_typeof(data) = 'object');

-- 2) Limite de tamanho por linha — 5 MB é bem generoso para o uso esperado
--    (milhares de transações cabem tranquilamente nisso) e evita que uma
--    chamada direta à API grave um payload desproporcional na própria linha.
--    Ajuste o número se um usuário legítimo algum dia esbarrar nesse teto.
alter table public.user_data
  add constraint user_data_size_limit
  check (pg_column_size(data) < 5 * 1024 * 1024);

-- ============================================================================
-- Pronto. Isso não substitui a validação do frontend (que continua sendo a
-- primeira linha de defesa para a experiência normal de uso) — só garante
-- que, mesmo contornando a UI, ninguém consegue gravar algo que não seja um
-- objeto JSON razoavelmente dimensionado na própria conta.
-- ============================================================================
