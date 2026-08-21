# Teste de carga — LaCalle Finance

Script simples (`run.mjs`, só Node, sem dependências) que simula N usuários
fazendo o mesmo ciclo de leitura/escrita que o app faz (`storage.get` /
`storage.set`) contra o Supabase de verdade, e mede p50/p95/p99 de latência.

## Antes de rodar

- **Gera tráfego real contra produção.** Comece pequeno (10-20 "usuários")
  antes de tentar simular centenas ou milhares.
- Cada "usuário simulado" é uma conta descartável
  (`audit-loadtest-<hex>@example.com`) criada de verdade via signup. O
  script apaga **tudo** que criou ao final — a linha em `user_data` **e**
  a conta de Auth em si — usando a `service_role key` só para isso.
- **A `service_role key` é privilégio total sobre o banco.** Passe-a
  **somente** como variável de ambiente na sua sessão de terminal local,
  na hora de rodar o script. Nunca a cole num arquivo do repositório
  (`.env` incluso — veja o `.gitignore`), nunca a hardcode em código, e
  nunca a compartilhe. O script nunca imprime o valor dela em nenhum log.
- Se o script for interrompido (Ctrl+C, ou um SIGTERM de algo que o esteja
  orquestrando), ele tenta limpar as contas já criadas antes de encerrar.
  Se alguma limpeza falhar — na interrupção ou ao final normal — o script
  lista explicitamente no console quais contas (e-mail + `user_id`)
  ficaram pendentes e o motivo, para você remover manualmente em
  **Authentication → Users**.
- Se tiver um projeto Supabase de staging separado, prefira rodar lá.
- Verifique os limites do seu plano Supabase (conexões simultâneas, rate
  limit de Auth) antes de simular volumes grandes — é comum esbarrar num
  limite da plataforma antes de qualquer limite do próprio app.

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
