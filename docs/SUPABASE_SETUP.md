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

As migrations estão em `supabase/migrations/` e devem ser aplicadas em ordem no Supabase SQL Editor (Dashboard > SQL Editor > New query).

Ordem de aplicação:

1. `20260515130000_productizacao_bolao_suprema.sql`
2. `20260515133000_harden_productizacao_helpers.sql`
3. `20260515143000_internal_product_governance.sql`
4. `20260515144500_harden_storage_listing.sql`
5. `20260515150000_harden_rpc_permissions.sql`
6. `20260515151000_index_new_foreign_keys.sql`
7. `20260515162000_harden_user_profile_privacy.sql`
8. `20260519090000_lock_user_privileged_columns.sql`
9. `20260519091000_enforce_prediction_market_lock.sql`
10. `20260519100000_lock_user_email_updates.sql`

Execute cada arquivo individualmente. Verificar que não há erros antes de passar ao próximo.

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
| `chat-media` | Sim | 10 MB | Imagem + áudio |
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
