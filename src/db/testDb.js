// Um Postgres de verdade para testar as regras de acesso (RLS), sem Docker e
// sem servidor: o PGlite é o Postgres compilado para rodar dentro do Node.
// Portado de LaCalle Life (branch life-pro, src/test/supabase-db.ts).
//
// O que imita do Supabase, e só isso: os papéis anon, authenticated e
// service_role; auth.users e auth.uid() (lido de request.jwt.claim.sub, como
// o Supabase faz); e as permissões padrão do schema public, que concede tudo
// a anon e authenticated. Quem barra é a RLS e os revoke das migrações; sem
// essas permissões o teste passaria por falta de permissão, não pela regra.
//
// As migrações vêm de supabase/migrations, as mesmas de produção, em ordem.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const file of readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort()) {
    try { await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8")); }
    catch (e) { throw new Error(`Migração ${file} falhou: ${e}`); }
  }
  return {
    db,
    async createUser(email) {
      const { rows } = await db.query("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
      return rows[0].id;
    },
    /** Roda `fn` como o app roda: papel authenticated (ou anon, com null) e auth.uid() = userId, numa transação. */
    as(userId, fn) {
      return db.transaction(async tx => {
        await tx.query(`set local role ${userId === null ? "anon" : "authenticated"}`);
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
        return fn(tx);
      });
    },
  };
}
