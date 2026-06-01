# Supabase Setup — Bolão Suprema

## Pré-requisitos

- Conta no Supabase (supabase.com).
- Domínio `suprema.group` verificado no Resend (para SMTP personalizado).
- Node 18+ instalado localmente para scripts de setup, se necessário.

## 1. Criar o projeto Supabase

1. Acessar supabase.com > New project.
2. Definir nome, senha e região.
3. Aguardar o provisionamento.
4. Anotar:
   - Project URL (usado em `VITE_SUPABASE_URL`).
   - Anon/public key (usado em `VITE_SUPABASE_ANON_KEY`).
   - A chave `service_role` **nunca deve ser usada no front-end**.

## 2. Aplicar as migrations

> **Fonte de verdade do banco = `supabase/migrations/**`.**
> O arquivo `supabase-schema.sql` na raiz é apenas um snapshot histórico
> DESATUALIZADO e INSEGURO se aplicado sozinho (policies antigas com
> `using (true)`). **Não use `supabase-schema.sql` para provisionar.**

As migrations estão em `supabase/migrations/` e devem ser aplicadas **todas, em
ordem de nome de arquivo (timestamp)**. A lista cresce ao longo do tempo — não
mantenha uma lista manual aqui; use sempre o conteúdo do diretório.

**Forma recomendada (Supabase CLI):**

```bash
# Banco do zero (ambiente novo / DR), recria tudo a partir das migrations:
supabase db reset

# Banco existente, aplica apenas as migrations pendentes:
supabase db push
```

**Alternativa manual (SQL Editor):** se não usar a CLI, abra cada arquivo de
`supabase/migrations/` em ordem alfabética/cronológica no Dashboard > SQL Editor
e execute um a um, conferindo que não há erro antes de seguir. As migrations são
idempotentes; um replay limpo (`supabase db reset`) deve passar sem erros.

## 3. Configurar Auth

### Configurações gerais

Dashboard > Authentication > Providers > Email:

- Enable Email provider: **ativado**.
- Confirm email: **ativado** (OTP, não Magic Link).
- OTP expiry: 600 segundos (10 minutos) recomendado.
- Minimum password length: não aplicável (app usa OTP).

### URL Configuration

Dashboard > Authentication > URL Configuration:

- Site URL: `https://bolao.suprema.group`
- Redirect URLs: `https://bolao.suprema.group/**`

Para desenvolvimento local adicionar também:
- `http://localhost:5173/**`

### Leaked Password Protection

Dashboard > Authentication > Security > Leaked Password Protection: **ativar**.

## 4. Configurar SMTP personalizado (Resend)

O plano Free do Supabase limita a 3 e-mails/hora. Para produção com ~300 usuários é necessário SMTP personalizado.

Dashboard > Authentication > SMTP Settings:

- Enable Custom SMTP: **ativar**.
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: chave API do Resend.
- Sender email: `noreply@suprema.group`
- Sender name: `Bolão Suprema`

Pré-requisito: domínio `suprema.group` verificado no painel do Resend.

## 5. Configurar os buckets de Storage

Se as migrations de storage foram aplicadas, os buckets são criados automaticamente. Verificar no Dashboard > Storage:

| Bucket | Público | Limite | MIMEs |
|--------|---------|--------|-------|
| `avatars` | Sim | 5 MB | JPEG, PNG, WebP, GIF |
| `banners` | Sim | 5 MB | JPEG, PNG, WebP, GIF |
| `bulletins` | Sim | 5 MB | JPEG, PNG, WebP, GIF |
| `chat-media` | Sim | 25 MB | Imagem + áudio (allowlist MIME) |
| `user-media` | Sim | 5 MB | JPEG, PNG, WebP, GIF (legado) |

Verificar que nenhum bucket tem listagem pública habilitada.

## 6. Validar RLS

Dashboard > Authentication > Policies ou via SQL:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Todas as tabelas devem ter `rowsecurity = true`.

## 7. Rodar Supabase Advisors

Dashboard > Advisors > Security:

- Verificar se há tabelas sem RLS.
- Verificar `security definer` functions com `search_path` mutável.
- Verificar functions com grant excessivo para `anon` ou `public`.

Dashboard > Advisors > Performance:

- Verificar índices ausentes em foreign keys.

## 8. Promover primeiro admin

Após criar o primeiro usuário via OTP, promovê-lo a admin/owner diretamente no banco:

```sql
update public.users
set is_admin = true, is_owner = true, user_role = 'owner', participant_status = 'active'
where email = 'admin@suprema.group';
```

Substituir pelo e-mail real do administrador.

## 9. Validação final

Após o setup completo:

- [ ] Login com OTP funciona.
- [ ] Novo usuário é criado com `participant_status = 'pending'`.
- [ ] Admin consegue aprovar participante.
- [ ] Palpite é aceito com mercado aberto.
- [ ] Palpite é rejeitado com mercado fechado.
- [ ] Upload de foto funciona.
- [ ] Chat em tempo real funciona.
- [ ] Ranking aparece corretamente.
- [ ] Supabase Advisors sem alertas críticos.

## Referências

- Documentação Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Documentação Supabase Auth: https://supabase.com/docs/guides/auth
- Documentação Supabase Storage: https://supabase.com/docs/guides/storage
