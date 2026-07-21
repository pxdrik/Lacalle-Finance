# Lacalle Finance — passo a passo do lançamento (Supabase + Netlify)

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

## Parte 3 — Publicar no Netlify

### Opção A — Via GitHub (recomendado, fica com deploy automático)

1. Suba este projeto pra um repositório no GitHub (pode ser privado).
   ```bash
   git init
   git add .
   git commit -m "Lacalle Finance"
   git branch -M main
   git remote add origin <url-do-seu-repositorio>
   git push -u origin main
   ```
   *(o `.env` não vai junto — ele já está no `.gitignore` de propósito,
   porque tem informação sensível)*
2. Vá em **[app.netlify.com](https://app.netlify.com)** e crie uma conta.
3. Clique em **"Add new site" → "Import an existing project"**.
4. Escolha o GitHub e selecione o repositório que você acabou de criar.
5. O Netlify já vai detectar automaticamente (por causa do `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Antes de clicar em "Deploy", vá em **"Add environment variables"** e
   adicione as duas mesmas variáveis do seu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Clique em **Deploy site**. Em 1-2 minutos seu site está no ar, num
   endereço tipo `nome-aleatorio.netlify.app` (dá pra trocar depois em
   **Site settings → Change site name**, ou colocar um domínio próprio de
   graça em **Domain settings**).

### Opção B — Deploy manual (mais rápido pra testar, sem GitHub)

```bash
npm run build
```

Isso cria uma pasta `dist/`. Vá em [app.netlify.com/drop](https://app.netlify.com/drop)
e arraste a pasta `dist` pra lá — o site sobe na hora. *(Só que aqui você
precisaria repetir esse processo manualmente toda vez que mudar algo — a
Opção A com GitHub é melhor a longo prazo.)*

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
  foram configuradas certinho no Netlify (Parte 3, passo 6).

## Sobre o app de celular (próximo passo, quando quiser)

Como agora os dados e o login vivem no Supabase (não mais presos a este
site), o caminho natural é criar um app em **React Native + Expo** que fala
com o **mesmo projeto Supabase** — nenhuma tabela ou regra de segurança
precisa mudar, só a parte visual (telas) seria refeita pro formato de app
nativo. É um passo separado — dá pra fazer quando quiser, sem pressa.
