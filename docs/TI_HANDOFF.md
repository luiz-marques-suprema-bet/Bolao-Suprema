# Handoff Tecnico - Bolao Suprema

Documento para revisao e aprovacao do T.I.

## Objetivo

O Bolao Suprema e uma aplicacao interna para palpites da Copa do Mundo 2026. O app cobre login corporativo, cadastro de participantes, palpites por partida, ranking, chat interno, boletins, notificacoes e painel administrativo.

## Status da release

Data de referencia: 2026-05-21.

Implementado e validado:

- Fluxo de palpites independente do admin.
- Formato Copa 2026 alinhado: 48 selecoes, 12 grupos, 104 partidas, Fase de 32 antes das oitavas.
- Salvamento de palpite com confirmacao real do Supabase.
- Salvamento em lote de grupo/fase por meio da RPC `save_match_predictions(jsonb)`.
- Trava por kickoff e status de mercado reforcada no banco.
- Admin restrito a operacoes de excecao: bloquear/reabrir, desfazer palpite, apurar resultado.
- Edge Function `football-data-sync` criada para football-data.org.
- `FOOTBALL_DATA_TOKEN` configurado como secret no Supabase.
- Edge Function executada com `season=2026`.
- Resultado informado do sync: `63` partidas atualizadas, `41` sem match.
- Edge Function redeployada com `verify_jwt=true`.
- Grants anonimos removidos de RPCs administrativas sensiveis.
- Listagem ampla do bucket `chat-media` removida.

Observacao sobre os `41` unmatched:

Esses jogos provavelmente correspondem a fases eliminatorias, placeholders ou registros da football-data.org que ainda nao possuem correspondencia direta na tabela `matches` por `home_code`, `away_code` e `kickoff_utc`. Isso nao impede a fase de grupos atual de funcionar.

## Repositorio e deploy

- Repositorio: `https://github.com/ojozinho/Bolao-Suprema`
- Branch principal: `main`
- Deploy: GitHub Actions para GitHub Pages
- URL: `https://bolao.suprema.group/`
- Rotas: HashRouter, por exemplo `/#/home`, `/#/prediction`, `/#/admin`
- Referencia de formato do torneio: [WC2026_FORMAT.md](WC2026_FORMAT.md)

## Stack

| Area | Tecnologia |
|------|------------|
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS, Framer Motion |
| Rotas | React Router v6 com HashRouter |
| Estado | Zustand |
| Backend | Supabase PostgreSQL, Auth, Realtime, Storage |
| Sync externo | Supabase Edge Function + football-data.org |
| Deploy | GitHub Actions + GitHub Pages |

## Supabase

Projeto:

- Ref: `mklmnxquvslflgljhgqn`
- Regiao: `us-east-1`
- Status observado: `ACTIVE_HEALTHY`

Tabelas principais:

| Tabela | Finalidade |
|--------|------------|
| `users` | Perfis, roles, status de participante |
| `matches` | Jogos, kickoff, status esportivo, mercado e dados football-data |
| `predictions` | Palpites por partida |
| `bracket_picks` | Palpites de chaveamento |
| `scoring_rules` | Regras de pontuacao |
| `ranking_snapshots` | Ranking consolidado |
| `ranking_breakdowns` | Detalhamento de pontos |
| `chat_messages` | Resenha |
| `poll_votes` | Votos de enquetes |
| `channel_pins` | Mensagens fixadas |
| `bulletins` | Comunicados internos |
| `notifications` | Avisos/notificacoes |
| `participant_invites` | Convites |
| `audit_logs` | Auditoria |

Storage:

- `avatars`
- `banners`
- `bulletins`
- `chat-media`
- `user-media` legado

## Variaveis e secrets

### GitHub Actions / frontend

Somente chaves publicas/publishable:

| Secret/variavel | Uso |
|-----------------|-----|
| `VITE_SUPABASE_URL` | URL publica do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon/publishable key |
| `VITE_TENOR_KEY` | Opcional, GIFs |
| `VITE_THESPORTSDB_KEY` | Opcional, busca de jogadores |

### Supabase Edge Function secrets

Nunca colocar esses valores no frontend:

| Secret | Uso |
|--------|-----|
| `FOOTBALL_DATA_TOKEN` | Token football-data.org |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso interno da Edge Function ao banco |
| `WORLD_NEWS_API_KEY` | Opcional, noticias da Copa 2026 via Edge Function `news-proxy` |
| `WORLD_NEWS_URL` | Opcional, endpoint alternativo da World News API |

## Fluxo de autenticacao

1. Usuario informa e-mail corporativo `@suprema.group`.
2. Supabase envia OTP.
3. Usuario valida o codigo.
4. Supabase emite sessao/JWT.
5. Novo usuario fica `pending`.
6. Admin aprova participante.
7. Usuario completa perfil.
8. Usuario acessa app.

## Roles e status

| Role/status | Permissao |
|-------------|-----------|
| `pending` | Aguardando aprovacao |
| `active` | Participa normalmente |
| `blocked` | Sem palpites/chat |
| `removed` | Removido/desativado |
| `user` | Palpites, ranking, resenha |
| `marketing` | User + boletins |
| `admin` | Operacao, resultados, participantes |
| `owner` | Admin + concessao de roles sensiveis |

Roles sensiveis devem ser definidas no banco/RPC. O frontend apenas reflete permissoes.

## Fluxo de palpites

### Fluxo normal do usuario

1. Usuario entra em `/#/prediction`.
2. Seleciona grupo ou partida.
3. Ajusta placares.
4. Salva jogo a jogo ou clica em `SALVAR GRUPO`.
5. Frontend chama Supabase.
6. UI so mostra como salvo apos resposta positiva.

### Controles no banco

Trigger:

- `trg_predictions_market_open`

Validacoes:

- partida existe;
- usuario autenticado;
- participante ativo;
- `market_status = open`;
- status nao esta `locked`, `live`, `finished`;
- `kickoff_utc > now()`;
- updates administrativos de pontuacao continuam permitidos.

RPC principal:

- `save_match_predictions(jsonb)`

## Admin

Admin nao e pre-requisito para usuario palpitar.

Admin serve para:

- bloquear mercado manualmente;
- reabrir em caso de erro operacional;
- registrar resultado;
- apurar pontos;
- remover/desfazer palpite especifico;
- gerenciar participantes;
- auditar acoes.

RPCs relevantes:

- `admin_update_match_status`
- `admin_bulk_match_status`
- `admin_delete_prediction`
- `settle_match_result`
- `admin_set_user_role`

Todas possuem checagem interna de permissao e nao devem ficar executaveis por `anon`.

## Integracao football-data.org

Documentacao especifica: [FOOTBALL_DATA_SYNC.md](FOOTBALL_DATA_SYNC.md)

Configuracao:

- Secret: `FOOTBALL_DATA_TOKEN`
- Edge Function: `football-data-sync`
- JWT: obrigatorio (`verify_jwt=true`)
- Rota: `/functions/v1/football-data-sync?season=2026`
- Competicao: `WC`
- Endpoint externo: `/v4/competitions/WC/matches?season=2026`

Comportamento:

- Busca jogos na football-data.org.
- Tenta casar primeiro por `football_data_id`.
- Se nao existir, tenta casar por `home_code`, `away_code` e `kickoff_utc`.
- Atualiza status, placar, minuto ao vivo, kickoff e status externo.
- Nao reabre lock manual de admin.

Resultado esperado inicial:

- Pode haver `unmatched` enquanto fases eliminatorias nao tiverem times definidos.
- Isso e esperado e deve ser monitorado, nao necessariamente erro.

## Migrations recentes

| Arquivo | Finalidade |
|---------|------------|
| `20260521103000_prediction_batch_and_football_data.sql` | Salvamento em lote e base football-data |
| `20260521110000_restrict_rpc_grants.sql` | Remove grants anonimos de RPCs sensiveis |
| `20260521110500_harden_chat_media_listing.sql` | Remove listagem ampla do bucket `chat-media` |

## Checklist de aprovacao

### Build e deploy

- [ ] `npm install`
- [ ] `npm run type-check`
- [ ] `npm run build`
- [ ] GitHub Actions finaliza sem erro.
- [ ] GitHub Pages abre a URL de producao.

### Supabase

- [ ] Todas as migrations aplicadas em ordem.
- [ ] RLS ativo nas tabelas publicas.
- [ ] Views publicas com `security_invoker=true`.
- [ ] `FOOTBALL_DATA_TOKEN` configurado como secret.
- [ ] `football-data-sync` ativa com `verify_jwt=true`.
- [ ] Security Advisor sem alertas criticos.
- [ ] Performance Advisor revisado.

### Funcional

- [ ] Login OTP funciona.
- [ ] Novo usuario fica pendente.
- [ ] Admin aprova usuario.
- [ ] Usuario completa perfil.
- [ ] Usuario salva um palpite individual.
- [ ] Usuario salva um grupo inteiro.
- [ ] Alteracao de palpite bloqueada apos fechar mercado/kickoff.
- [ ] Admin bloqueia/reabre mercado.
- [ ] Admin registra resultado e pontuacao atualiza.
- [ ] Ranking reflete pontos.
- [ ] Resenha funciona em duas abas.
- [ ] Upload de avatar/banner funciona.

### Seguranca

- [ ] Nenhuma `service_role` key no frontend, GitHub Actions ou repositorio.
- [ ] Tokens colados em terminal/chat foram revogados se necessario.
- [ ] Bucket `chat-media` nao permite listagem ampla.
- [ ] RPCs administrativas nao possuem grant para `anon`.
- [ ] Site URL e Redirect URLs do Supabase Auth conferidos.
- [ ] SMTP corporativo configurado para evitar limite do plano Free.
- [ ] Leaked Password Protection avaliado no dashboard.

## Riscos e observacoes

| Risco | Mitigacao |
|-------|-----------|
| Usuario tenta alterar palpite direto pela API apos kickoff | Trigger no banco bloqueia |
| Admin abre/fecha mercado por engano | Auditoria e RPCs com log |
| Token football-data exposto | Deve ficar apenas em Supabase secrets |
| Service role exposta | Nunca usar no frontend; rotacionar se vazou |
| Dados externos ainda incompletos | `unmatched` monitorado no retorno da Edge Function |
| GitHub Pages sem rewrite de rotas | HashRouter usado em todas as rotas |

## Comandos uteis

```bash
npm run type-check
npm run build
```

Teste local com mock:

```powershell
$env:VITE_MOCK_AUTH="true"
npm run dev
```

## Responsabilidade operacional

Codigo-fonte e migrations ficam neste repositorio. Secrets, Auth, SMTP, rotacao de chaves, monitoramento de advisors e aprovacao de participantes ficam sob operacao do ambiente Supabase/GitHub da empresa.
