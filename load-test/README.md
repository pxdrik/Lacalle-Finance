# Teste de carga — LaCalle Finance

Script simples (`run.mjs`, só Node, sem dependências) que simula N usuários
fazendo o mesmo ciclo de leitura/escrita que o app faz (`storage.get` /
`storage.set`) contra o Supabase de verdade, e mede p50/p95/p99 de latência.

## Antes de rodar

- **Gera tráfego real contra produção.** Comece pequeno (10-20 "usuários")
  antes de tentar simular centenas ou milhares.
- Cada "usuário simulado" é uma conta descartável
  (`audit-loadtest-<hex>@mailinator.com`) provisionada via admin API
  (`service_role`) e autenticada via magic-link — **não** via signup/login
  público por senha. Isso é proposital: com "Confirm email" e o CAPTCHA
  (Turnstile) ativos em produção, os endpoints públicos de signup/login
  exigem resolver um captcha, que não dá pra fazer num script — e o script
  **nunca** desativa o CAPTCHA pra contornar isso. Ver o comentário no topo
  de `run.mjs` ("COMO AS CONTAS DE TESTE AUTENTICAM") para o fluxo
  completo.
- **A partir do momento em que a conta de teste tem uma sessão, todo
  GET/SET do ciclo de carga usa só o token dela + a `anon key`** —
  exatamente como um usuário comum autenticado no app. `service_role`
  nunca lê nem escreve em `user_data` durante a medição; ela só existe
  para provisionar a conta, gerar o magic-link, e no cleanup. Isso é
  deliberado: o objetivo é medir o comportamento real do RLS sob carga,
  não contorná-lo.
- O script apaga **tudo** que criou ao final — a linha em `user_data`
  **e** a conta de Auth em si — usando a `service_role key` só para isso.
- **A `service_role key` é privilégio total sobre o banco.** Passe-a
  **somente** como variável de ambiente local (ou pelo arquivo
  `load-test/.env.loadtest`, ver abaixo). Nunca a cole num arquivo do
  repositório, nunca a hardcode em código, e nunca a compartilhe. O
  script nunca imprime o valor dela em nenhum log.
- Se o script for interrompido (Ctrl+C, ou um SIGTERM de algo que o esteja
  orquestrando), ele tenta limpar as contas já criadas antes de encerrar,
  em duas passadas (a segunda cobre uma conta cuja criação estava em voo
  bem no instante da interrupção). Se alguma limpeza falhar — na
  interrupção ou ao final normal — o script lista explicitamente no
  console quais contas (e-mail + `user_id`) ficaram pendentes e o motivo,
  para você remover manualmente em **Authentication → Users**.
- Se tiver um projeto Supabase de staging separado, prefira rodar lá.
- Verifique os limites do seu plano Supabase (conexões simultâneas, rate
  limit de Auth) antes de simular volumes grandes — é comum esbarrar num
  limite da plataforma antes de qualquer limite do próprio app. Em
  particular, a verificação de magic-link tem rate limit por IP (30 a
  cada 5 min) — como o script roda de uma única máquina, ele escalona as
  autenticações ao longo do tempo (`--ramp-ms`) pra reduzir quantas caem
  na mesma janela, mas pra N grande numa janela curta ainda é esperado
  ver algumas rejeitadas por rate limit — isso é uma limitação de rodar
  de um IP só, não um problema do app.

## Como rodar

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co \
VITE_SUPABASE_ANON_KEY=sua-anon-key \
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key \
node load-test/run.mjs --users=10 --duration=30
```

A `SUPABASE_SERVICE_ROLE_KEY` fica em **Project Settings → API → service_role**
no painel do Supabase. Exporte-a só na sessão de terminal em que for rodar
o script — sem ela, o script se recusa a começar (para não deixar contas
de Auth órfãs em produção).

**No Windows/PowerShell**, colar uma chave longa direto no console costuma
corromper caracteres (problema de codificação do terminal). Em vez de
`$env:SUPABASE_SERVICE_ROLE_KEY = "..."`, crie um arquivo
`load-test/.env.loadtest` (nunca versionado — já está no `.gitignore`) num
editor de texto de verdade, com uma linha `SUPABASE_SERVICE_ROLE_KEY=<valor>`,
salve como UTF-8, e rode o script sem precisar setar essa variável na mão —
ele lê o arquivo sozinho.

- `--users`: quantos "usuários" simultâneos simular (padrão 10)
- `--duration`: por quantos segundos cada um fica fazendo ciclos de
  leitura/escrita (padrão 30)

## O que observar

- **p95/p99 de GET e SET** — tempo de resposta sob concorrência.
- **Taxa de erro** — qualquer coisa diferente de 2xx.
- Durante o teste, acompanhe o painel do Supabase (**Reports** /
  **Database** → conexões ativas, CPU) para ver se algo satura antes da
  latência degradar visivelmente no script.

Isso cobre o cenário "escrita/leitura concorrente do mesmo tipo de operação
que o app faz" — não substitui testar o carregamento da UI com um histórico
de transações muito grande (ver observação sobre paginação/virtualização no
relatório de auditoria), que é um teste de frontend, não de backend.
