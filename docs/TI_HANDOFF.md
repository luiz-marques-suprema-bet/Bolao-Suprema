# Handoff Técnico — Bolão Suprema

## Objetivo do projeto

O Bolão Suprema é uma aplicação web interna para palpites da Copa do Mundo 2026, destinada aos colaboradores da Suprema Gaming. O app permite que participantes façam palpites de partidas e do chaveamento, acompanhem o ranking e interajam via chat em tempo real.

## Escopo funcional

| Módulo | Descrição |
|--------|-----------|
| Autenticação | OTP por e-mail corporativo (@suprema.group) |
| Onboarding | Wizard de cadastro de perfil para novos usuários |
| Palpites | Placar de partidas, fase de grupos e eliminatórias |
| Ranking | Pontuação em tempo real com snapshots históricos |
| Resenha | Chat ao vivo: texto, imagem, GIF, áudio, enquetes |
| Boletim | Comunicados internos (admin/marketing) |
| Notificações | Avisos internos e sistema de notificações |
| Perfil | Foto, banner, bio, seleção/jogador favorito |
| Admin | Controle de mercados, resultados, participantes, exportação |
| Auditoria | Log de ações administrativas |

## Stack

- **Frontend:** React 19 + TypeScript + Vite — SPA estática, sem SSR.
- **Estilo:** Tailwind CSS com design system próprio.
- **Roteamento:** React Router v6 com HashRouter (necessário para GitHub Pages).
- **Estado:** Zustand com persistência local via localStorage.
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage).
- **Deploy:** GitHub Actions → GitHub Pages (branch `gh-pages`).

## Fluxo de autenticação

1. Usuário informa e-mail corporativo.
2. Supabase envia OTP de 6 dígitos para o e-mail.
3. Usuário insere o código.
4. Supabase emite JWT; o cliente armazena a sessão.
5. Novo usuário entra com `participant_status = 'pending'` — aguarda aprovação de admin.
6. Após aprovação, perfil é completado via wizard `/setup`.
7. Com perfil completo (`firstName` + `dept` preenchidos), usuário acessa o app.

## Modelo de permissões

| Role | participant_status | Pode fazer |
|------|--------------------|-----------|
| Qualquer | `pending` | Ver onboarding, aguardar aprovação |
| `user` | `active` | Palpitar, usar chat, ver ranking |
| `user` | `blocked` | Apenas ver perfil — sem palpites ou chat |
| `marketing` | `active` | Tudo de `user` + publicar/editar boletins |
| `admin` | `active` | Tudo + controle de mercados, resultados, participantes |
| `owner` | `active` | Tudo + concessão de roles sensíveis |

Roles são concedidas exclusivamente por admins/owners via Supabase. O front-end apenas reflete permissões lidas do banco.

## Banco de dados

Projeto Supabase: `mklmnxquvslflgljhgqn`

Tabelas principais:

| Tabela | Descrição |
|--------|-----------|
| `users` | Perfis, roles, status de participante |
| `matches` | Calendário de partidas, status de mercado |
| `predictions` | Palpites por partida |
| `bracket_picks` | Palpites de chaveamento |
| `scoring_rules` | Regras de pontuação configuráveis |
| `ranking_snapshots` | Snapshots de ranking |
| `ranking_breakdowns` | Detalhamento por partida |
| `chat_messages` | Mensagens da Resenha |
| `poll_votes` | Votos em enquetes |
| `channel_pins` | Mensagens fixadas |
| `bulletins` | Comunicados do Boletim |
| `notifications` | Notificações internas |
| `participant_invites` | Links de convite |
| `audit_logs` | Log de ações administrativas |

Buckets Storage: `avatars`, `banners`, `bulletins`, `chat-media`, `user-media` (legado).

## RLS e segurança

- RLS habilitado em todas as tabelas.
- Ações administrativas protegidas por RPCs com `security definer`.
- Trigger `trg_prevent_user_privilege_escalation` bloqueia autoelevação de privilégios.
- Trigger `trg_predictions_market_open` bloqueia palpites após fechamento de mercado.

Detalhes completos: [SECURITY.md](SECURITY.md)

## Publicação no GitHub Pages

- Branch de deploy: `gh-pages` (gerada automaticamente pelo GitHub Actions).
- Workflow: `.github/workflows/deploy.yml`.
- Gatilho: push para `main`.
- URL: `https://ojozinho.github.io/Bolao-Suprema/`

## Variáveis de ambiente necessárias

Configurar em: GitHub > Settings > Secrets and variables > Actions

| Secret | Descrição |
|--------|-----------|
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable |

As demais variáveis (Tenor, TheSportsDB, Football News) são opcionais.

## Checklist de validação do T.I.

### Pré-produção

- [ ] Secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configurados no GitHub.
- [ ] Migrations em `supabase/migrations/` aplicadas em ordem no Supabase.
- [ ] Domínio `@suprema.group` configurado no Supabase Auth (Site URL + Redirect URLs).
- [ ] SMTP personalizado configurado (Resend com domínio `suprema.group`).
- [ ] Supabase Auth Leaked Password Protection habilitado no dashboard.
- [ ] RLS habilitado em todas as tabelas (verificar via Supabase Advisors).
- [ ] Buckets de storage com políticas corretas (sem listagem pública).

### Pós-deploy

- [ ] Login com OTP funciona em `https://ojozinho.github.io/Bolao-Suprema/`.
- [ ] Rotas hash funcionam: `/#/home`, `/#/prediction`, `/#/ranking`, `/#/admin`.
- [ ] Novo usuário é criado com `participant_status = 'pending'`.
- [ ] Admin consegue aprovar participante e alterar status.
- [ ] Palpite funciona quando mercado está aberto.
- [ ] Palpite é bloqueado quando mercado está fechado (testar via painel admin).
- [ ] Upload de foto e banner funcionam.
- [ ] Chat em tempo real funciona entre abas/dispositivos diferentes.

## Riscos conhecidos e mitigação

| Risco | Controle implementado |
|-------|-----------------------|
| Autoelevação de privilégios via API direta | Trigger `trg_prevent_user_privilege_escalation` — verificação no banco |
| Alteração de e-mail via API direta | Mesma trigger — campo `email` incluído na lista protegida |
| Palpite enviado após kickoff via API direta | Trigger `trg_predictions_market_open` — verificação no banco |
| Chave `anon` exposta no repositório público | Chave anon é publishable por definição; RLS é a barreira de autorização |
| URL maliciosa em GIF/imagem de chat | `isSafeHttpUrl` valida protocolo `https://` antes de renderizar |
| Upload de arquivo com tipo indevido | MIME allowlist e limite de tamanho em `src/lib/supabase.ts` |
| Imagens de usuário no histórico Git | Diretório `uploads/` adicionado ao `.gitignore`; histórico anterior pode conter arquivos — ver pendências abaixo |

## Pendências operacionais

As seguintes ações não são de responsabilidade do código-fonte e devem ser executadas pelo time de T.I. no ambiente de produção:

1. **Aplicar migrations no Supabase SQL Editor** — em ordem cronológica, conforme listado em `docs/SUPABASE_SETUP.md`.
2. **Rodar Supabase Security Advisor** após aplicar as migrations e validar que não há alertas críticos.
3. **Ativar Leaked Password Protection** no Supabase Dashboard > Authentication > Security, se disponível no plano contratado.
4. **Configurar SMTP personalizado** com domínio `suprema.group` para evitar o limite de 3 e-mails/hora do plano Free (instruções em `docs/SUPABASE_SETUP.md`).
5. **Validar Site URL e Redirect URLs** no Supabase Auth para o domínio de produção.
6. **Decidir sobre limpeza do histórico Git** — o diretório `uploads/` contém imagens de desenvolvimento presentes no histórico. Caso o T.I. avalie que representam risco, será necessária limpeza com `git filter-repo` ou BFG Repo-Cleaner. Essa operação é destrutiva e requer aprovação prévia.

### Migrations desta release (aplicar no Supabase SQL Editor)

| Arquivo | Conteúdo |
|---------|----------|
| `supabase/migrations/20260519090000_lock_user_privileged_columns.sql` | Trigger de proteção contra autoelevação de privilégios |
| `supabase/migrations/20260519091000_enforce_prediction_market_lock.sql` | Trigger de bloqueio de palpites fora do mercado |
| `supabase/migrations/20260519100000_lock_user_email_updates.sql` | Extensão da trigger para incluir proteção do campo `email` |

## Contato / responsável

Responsável técnico pelo desenvolvimento: equipe T.I. / Suprema Gaming.

Para dúvidas sobre funcionalidades do app ou regras de negócio, consultar o administrador do Bolão Suprema.
