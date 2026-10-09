# Lacalle Finance — passo a passo do lançamento (Supabase + Vercel)

Este projeto já está migrado e testado: o `npm run build` roda limpo. Falta
só você criar as contas e ligar os fios. Siga na ordem.

---

## Parte 1 — Criar o projeto no Supabase

1. Vá em **[supabase.com](https://supabase.com)** e crie uma conta (dá pra
   entrar com GitHub).
2. Clique em **"New project"**.
   - **Name**: `lacalle-finance` (ou o que preferir)
   - **Database password**: gere uma forte e **guarde em um lugar seguro**
     (não é a mesma senha que você vai usar pra logar no app — essa é só do
     banco de dados por trás).
   - **Region**: escolha **South America (São Paulo)** — fica mais rápido
     pro Brasil e ajuda com a LGPD (dado fica armazenado no Brasil).
3. Espera uns 2 minutos enquanto o projeto é criado.

### Rodar o schema do banco

4. No menu lateral, clique em **SQL Editor** → **New query**.
5. Abra o arquivo **`supabase-schema.sql`** (está na raiz deste projeto),
   copie o conteúdo inteiro, cole no editor e clique em **Run**.
   - Isso cria a tabela `user_data` e as regras de segurança (RLS) que
     garantem que cada pessoa só vê os próprios dados.

### Configurar o login por e-mail

6. No menu lateral, vá em **Authentication → Providers**.
7. Confirme que **Email** está habilitado (já vem habilitado por padrão).
8. Decisão importante — **"Confirm email"**:
   - **Desligado** (Authentication → Settings → desmarcar "Enable email
     confirmations"): mais rápido pra testar, a pessoa já entra assim que
     cria a conta. Bom pra uso familiar/fechado.
   - **Ligado** (padrão): exige clicar num link no e-mail antes do primeiro
     login. Mais seguro, recomendado se algum dia mais gente de fora for
     usar. Pode trocar isso a qualquer momento, não é definitivo.

### Pegar as chaves da API

9. Vá em **Project Settings** (ícone de engrenagem) → **API**.
10. Anote dois valores:
    - **Project URL** (algo como `https://xxxxx.supabase.co`)
    - **anon public key** (uma chave longa) — **não** use a `service_role
      key` em lugar nenhum do site.

---

## Parte 2 — Rodar o projeto no seu computador (pra testar antes de publicar)

Precisa ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais
nova).

```bash
# dentro da pasta do projeto:
npm install
cp .env.example .env
```

Abra o `.env` que acabou de criar e cole os dois valores que você anotou:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

Agora rode:

```bash
npm run dev
```

Abra o link que aparecer no terminal (geralmente `http://localhost:5173`).
Crie uma conta de teste, cadastre uma transação, e confira no Supabase
(**Table Editor → user_data**) se apareceu uma linha com seus dados. Se
apareceu, está tudo funcionando.

---

## Parte 3 — Publicar na Vercel

Publicado em **https://lacalle-finance.vercel.app** (projeto `lacalle-finance`
na Vercel, ligado a este repositório no GitHub). Até 09/10/2026 era o
Netlify; saiu porque a cota acabava e o deploy do `main` era pulado.

- Cada push no `main` publica sozinho; cada PR ganha uma prévia (que usa o
  banco de produção).
- O `vercel.json` define build (`npm run build`, pasta `dist`), o
  redirecionamento da página única e os cabeçalhos de segurança (CSP, HSTS…).
- Variáveis de ambiente (Production e Preview): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` e `VITE_TURNSTILE_SITE_KEY`.
- Endereço novo precisa entrar em três lugares: Supabase → Authentication →
  URL Configuration; o segredo `ALLOWED_ORIGINS` da função `delete-account`;
  e os hostnames do widget no Cloudflare Turnstile (sem isso o login, que
  exige CAPTCHA, não funciona).

---

## Depois de publicado

- **Redefinir senha**: o link de "esqueci minha senha" (já implementado na
  tela de login) manda um e-mail via Supabase. Por padrão o Supabase usa um
  servidor de e-mail de teste com limite baixo de envios — se for usar
  bastante, configure um provedor de e-mail próprio em **Authentication →
  Settings → SMTP Settings** (pode ficar pra depois, não trava o uso normal).
- **Ver/gerenciar usuários**: Supabase → **Authentication → Users**.
- **Ver os dados salvos**: Supabase → **Table Editor → user_data**.
- **Se algo não carregar**: abra o console do navegador (F12) — se aparecer
  erro sobre `VITE_SUPABASE_URL`, é sinal que as variáveis de ambiente não
  foram configuradas certinho na Vercel (Parte 3).

## Parte 4 — Checklist pós-auditoria (fazer antes de abrir pra mais gente)

Estes passos vieram de uma auditoria de segurança e **não dá pra fazer só
editando código** — são configurações que só você, logado no painel do
Supabase/Vercel, consegue mudar. O código já está preparado para todos
eles; falta só ligar.

### 1. Rodar o SQL de hardening

No **SQL Editor** do Supabase, cole e rode o conteúdo de
`supabase-schema-v2-hardening.sql` (depois do `supabase-schema.sql` original,
que já deve ter sido rodado). Isso adiciona duas validações mínimas no
banco: `data` sempre tem que ser um objeto JSON, e tem um teto de tamanho —
sem isso, hoje o banco aceita qualquer coisa gravada diretamente pela API
(fora da UI), como valores absurdos ou payloads gigantes na própria conta.

### 2. Ativar confirmação de e-mail

**Authentication → Settings/Providers → Email**, ligue **"Confirm email"**.
Hoje qualquer e-mail (inclusive de terceiros) vira conta ativa na hora,
sem confirmar posse do e-mail — combinado com a criação de conta, isso
facilita cadastro em massa e uso de e-mails alheios.

### 3. Ativar CAPTCHA (bot/brute-force protection)

1. Crie um site grátis em
   [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) —
   escolha o modo "Managed". Anote o **Site Key** e o **Secret Key**.
2. No Supabase: **Authentication → Attack Protection → Enable CAPTCHA
   protection**, cole o **Secret Key**, escolha provedor "Turnstile".
3. No `.env` local e nas variáveis de ambiente da Vercel, adicione:
   ```
   VITE_TURNSTILE_SITE_KEY=seu-site-key-aqui
   ```
4. Faça um novo deploy (Vercel) / rode `npm run dev` de novo localmente.

O widget só aparece na tela de login se essa variável estiver definida — sem
ela, o app continua funcionando exatamente como antes.

### 4. Implantar a Edge Function `delete-account` atualizada (CORS)

A função foi corrigida para responder ao preflight CORS do navegador (antes,
o botão "apagar conta" quebrava silenciosamente em produção). Pra valer,
você precisa reimplantar a função e configurar a(s) origem(ns) permitida(s):

```bash
npx supabase login
npx supabase link --project-ref mspkkvpmjruuxgggsxdr
npx supabase secrets set ALLOWED_ORIGINS=https://lacalle-finance.vercel.app
npx supabase functions deploy delete-account
```

Use o domínio real onde o site está publicado (pode listar mais de um separado por vírgula, ex.: incluindo um
domínio próprio, se tiver). **Nunca use `*` aqui** — essa função aceita o
token de login de quem chama.

### 5. Headers de segurança e dependências

Já feito no código (`vercel.json` tem CSP/HSTS/X-Frame-Options, e o
`vite` foi atualizado para a versão sem as CVEs conhecidas) — só publicar de
novo (`git push` / novo deploy) já aplica.

### 6. CI

Já adicionado em `.github/workflows/ci.yml`: toda vez que alguém der push ou
abrir PR contra `main`, os testes (`npm test`) e o build (`npm run build`)
rodam automaticamente. Não precisa configurar nada — só empurrar pro GitHub.

### 7. Teste de carga (só antes de abrir ao público em geral)

Não incluído automaticamente por rodar contra o Supabase de produção — veja
`load-test/README.md` antes de rodar, e rode primeiro com poucos usuários
simulados.

---

## Sobre o app de celular (próximo passo, quando quiser)

Como agora os dados e o login vivem no Supabase (não mais presos a este
site), o caminho natural é criar um app em **React Native + Expo** que fala
com o **mesmo projeto Supabase** — nenhuma tabela ou regra de segurança
precisa mudar, só a parte visual (telas) seria refeita pro formato de app
nativo. É um passo separado — dá pra fazer quando quiser, sem pressa.
