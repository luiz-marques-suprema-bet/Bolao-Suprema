# Bolao Suprema - Guia de T.I.

## Visao geral

Bolao Suprema e um app interno para palpites da Copa, com auth via Supabase, perfis, palpites, ranking, Resenha, Boletim, administracao, auditoria e exportacoes.

## Variaveis de ambiente

- `VITE_SUPABASE_URL`: URL publica do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: anon/publishable key do Supabase.
- `VITE_TENOR_KEY`: opcional para GIFs.
- `VITE_PEXELS_API_KEY`, `VITE_FNEWS_URL`, `VITE_FNEWS_KEY`, `VITE_FNEWS_HOST`: opcionais para conteudo externo.
- `VITE_MOCK_AUTH=true`: opcional apenas para teste local explicito.

Nunca use service role no frontend e nunca commite `.env`.

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, login e acoes persistentes devem falhar de forma clara; isso nao deve ser usado para validar producao.

## Supabase

Projeto: `mklmnxquvslflgljhgqn`

Principais tabelas:

- `users`: perfis, roles, status de participante e privacidade.
- `matches`: agenda, resultados, status esportivo e `market_status`.
- `predictions`: palpites por partida.
- `bracket_picks`: palpites de chave.
- `scoring_rules`: regras configuraveis de pontuacao.
- `ranking_snapshots` e `ranking_breakdowns`: ranking e transparencia de pontos.
- `chat_messages`, `poll_votes`, `channel_pins`: Resenha.
- `bulletins`: comunicados de marketing/endomarketing.
- `participant_invites`: convites.
- `notifications`: notificacoes internas.
- `audit_logs`: auditoria.

Buckets:

- `avatars`: novos avatares.
- `banners`: novos banners.
- `bulletins`: imagens de boletim.
- `user-media`: legado; manter para URLs antigas.

Limite de upload: 5 MB. Mimes: JPG, PNG, WEBP, GIF.

## Roles e participantes

- `pending`: aguardando aprovacao; acesso limitado.
- `active`: participa normalmente.
- `blocked`: sem palpites/chat.
- `removed`: removido/desativado.
- `user`: usuario comum.
- `marketing`: gerencia boletins e uploads editoriais.
- `admin`: participantes, mercados, resultados, ranking, chat, exportacoes.
- `owner`: concede roles sensiveis e controla configuracoes.

Roles sensiveis devem ser concedidas no banco por admin/owner. O frontend apenas reflete permissoes.

## Setup local

```bash
npm install
npm run type-check
npm run build
npm run dev
```

## Deploy

GitHub Pages publica a partir de `main`.

Checklist:

1. Verificar secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Rodar `npm run build`.
3. Fazer merge/push em `main`.
4. Confirmar Pages em `https://ojozinho.github.io/Bolao-Suprema/`.
5. Validar rotas hash `/#/home`, `/#/prediction`, `/#/admin`.

## Migrations

Migrations ficam em `supabase/migrations`.

Aplicadas nesta onda:

- `20260515143000_internal_product_governance.sql`
- `20260515144500_harden_storage_listing.sql`
- `20260515150000_harden_rpc_permissions.sql`
- `20260515151000_index_new_foreign_keys.sql`
- `20260515162000_harden_user_profile_privacy.sql`

Antes de aplicar em producao:

1. Gerar snapshot/auditoria.
2. Revisar SQL.
3. Confirmar rollback.
4. Aplicar em branch/dev se disponivel.
5. Aplicar no projeto principal.
6. Validar com queries e advisors.

## Backup e rollback

Nunca apagar tabelas/buckets antigos sem confirmacao. Para rollback rapido, reverta o commit do app e mantenha as tabelas novas. Rollback destrutivo exige backup validado.

## Fluxos principais

- Usuario solicita OTP com e-mail corporativo.
- Novo usuario entra pendente.
- Admin aprova participante.
- Usuario completa perfil, palpita e acompanha ranking.
- Admin bloqueia/desbloqueia mercados e apura resultados.
- Marketing publica boletins.
- Admin modera Resenha e consulta auditoria/exportacoes.
- Admin cria links de convite no painel operacional; usuario entra pendente ate aprovacao.
- Avisos internos aparecem em `/#/notificacoes`.

## LGPD e privacidade

O app salva dados de perfil, palpites, mensagens, uploads e logs de auditoria. Ranking/chat nao devem expor e-mail. Perfil tem opcoes de privacidade. `privacy_hide_profile` e aplicado na UI e na RLS de `users`: o proprio usuario e admins leem o perfil, usuarios comuns nao leem perfis marcados como privados. Dados administrativos ficam protegidos por RLS/RPC.

## Limitacoes conhecidas

- WhatsApp/e-mail/push estao modelados como canais de notificacao, mas nao integrados a provedores externos nesta entrega.
- A Copa 2026 completa tera 104 jogos; a base atual cobre a fase de grupos existente no app e foi preparada para expansao.
