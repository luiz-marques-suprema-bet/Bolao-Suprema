# Bolao Suprema

Aplicacao web interna para o bolao da Copa do Mundo 2026 da Suprema.

## Resumo executivo para T.I.

O Bolao Suprema e uma SPA React/Vite publicada no GitHub Pages. Autenticacao, banco, realtime, storage, regras de seguranca e Edge Functions rodam no Supabase.

Estado atual do fluxo principal:

- Usuario pode palpitar jogo a jogo ou salvar um grupo inteiro de uma vez.
- Palpite pode ser alterado ate o kickoff individual da partida.
- A trava de horario nao depende do frontend: o banco bloqueia insert/update fora do mercado aberto.
- Modelo Copa 2026 revisado para 48 selecoes, 12 grupos, 104 partidas e Fase de 32 antes das oitavas.
- Tela admin e camada operacional de excecao: bloquear/reabrir mercados, desfazer palpites se necessario e apurar resultados.
- Pontuacao e ranking sao calculados no Supabase quando resultados sao apurados.
- Sync externo com football-data.org roda via Edge Function, sem token no frontend.

Ultima validacao informada em 2026-05-21:

- `FOOTBALL_DATA_TOKEN` configurado como secret no Supabase.
- Edge Function `football-data-sync` executada com `season=2026`.
- `63` partidas atualizadas.
- `41` partidas sem match, esperado para fases futuras/placeholders ainda sem times definidos.

Handoff tecnico completo: [docs/TI_HANDOFF.md](docs/TI_HANDOFF.md)

Formato da Copa 2026 usado pelo app: [docs/WC2026_FORMAT.md](docs/WC2026_FORMAT.md)

## Funcionalidades

- Login por OTP com e-mail corporativo `@suprema.group`.
- Perfil de participante com foto, banner, bio, selecao e jogador favorito.
- Palpites de placar por partida.
- Salvamento em lote por grupo na fase de grupos.
- Travamento automatico por kickoff e por status de mercado.
- Apostas gerais: campeao, vice e artilheiro.
- Ranking geral e detalhamento de pontos.
- Resenha: chat com texto, imagem, GIF, audio e enquetes.
- Boletim: comunicados internos para admin/marketing.
- Notificacoes internas.
- Painel admin para participantes, mercados, resultados, auditoria e exportacoes.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS |
| Animacoes | Framer Motion |
| Rotas | React Router v6 com HashRouter |
| Estado | Zustand |
| Backend | Supabase PostgreSQL, Auth, Realtime, Storage |
| Sync externo | Supabase Edge Function + football-data.org |
| Deploy | GitHub Actions para GitHub Pages |

## Arquitetura

- SPA estatica em GitHub Pages.
- HashRouter (`/#/rota`) para compatibilidade com GitHub Pages.
- Supabase Auth emite sessao/JWT.
- Supabase PostgreSQL aplica RLS, triggers e RPCs.
- Supabase Realtime atualiza partidas/chat.
- Supabase Storage guarda imagens e midias.
- Edge Function `football-data-sync` sincroniza dados esportivos de football-data.org.

Mais detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Fluxo de palpites

1. Usuario autenticado acessa `/#/prediction`.
2. Pode ajustar placares jogo a jogo.
3. Pode salvar um grupo inteiro com `SALVAR GRUPO`.
4. O frontend so marca como salvo depois de confirmacao do Supabase.
5. O banco valida:
   - usuario autenticado;
   - participante ativo;
   - partida existente;
   - `market_status = open`;
   - status nao esta `locked`, `live` ou `finished`;
   - `kickoff_utc > now()`.
6. Depois do kickoff, a trigger `trg_predictions_market_open` impede alteracao mesmo que alguem tente chamar a API direto.

RPC principal:

- `public.save_match_predictions(jsonb)`

Tabela principal:

- `public.predictions`

## Admin

O admin nao e necessario para o fluxo normal de palpites. Ele existe para operacao:

- bloquear/reabrir partida ou grupo;
- registrar resultado;
- apurar pontos;
- remover/desfazer palpite quando necessario;
- gerenciar participantes;
- revisar auditoria.

RPCs administrativas possuem checagem de admin/owner no banco e nao devem ser expostas a `anon`.

## Supabase

Projeto atual:

- Ref: `mklmnxquvslflgljhgqn`
- Regiao: `us-east-1`

Migrations ficam em [supabase/migrations](supabase/migrations).

Migrations recentes importantes:

- `20260521103000_prediction_batch_and_football_data.sql`
  - Cria `save_match_predictions(jsonb)`.
  - Adiciona colunas `football_data_id`, `football_data_status`, `football_data_last_updated` em `matches`.
  - Ajusta helper de mercado.
- `20260521110000_restrict_rpc_grants.sql`
  - Remove execucao anonima de RPCs sensiveis.
- `20260521110500_harden_chat_media_listing.sql`
  - Remove listagem ampla do bucket `chat-media`.

Edge Function:

- Codigo: [supabase/functions/football-data-sync/index.ts](supabase/functions/football-data-sync/index.ts)
- Nome: `football-data-sync`
- Deploy esperado: `verify_jwt=true`
- Endpoint: `https://<project-ref>.functions.supabase.co/football-data-sync?season=2026`
- Codigo: [supabase/functions/news-proxy/index.ts](supabase/functions/news-proxy/index.ts)
- Nome: `news-proxy`
- Deploy esperado: `verify_jwt=true`
- Funcao: proxy server-side para noticias da Copa 2026

Documentacao da integracao: [docs/FOOTBALL_DATA_SYNC.md](docs/FOOTBALL_DATA_SYNC.md)

## Variaveis e secrets

### Frontend / GitHub Actions

Essas variaveis sao publicas para o build do app. Apenas chaves publishable podem aparecer aqui.

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL publica do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | Anon/publishable key do Supabase |
| `VITE_TENOR_KEY` | Nao | GIFs da Resenha |
| `VITE_THESPORTSDB_KEY` | Nao | Busca de jogadores |
| `VITE_MOCK_AUTH` | Nao | `true` apenas para desenvolvimento local |

Noticias da Copa 2026 nao usam chave `VITE_*`. Se houver chave paga, ela fica
somente no secret da Edge Function `news-proxy`; sem chave, o proxy usa fallback
server-side via Google News RSS.

### Supabase Edge Function secrets

Esses secrets ficam no Supabase. Nunca entram no frontend, GitHub Pages ou repositorio.

| Secret | Descricao |
|--------|-----------|
| `FOOTBALL_DATA_TOKEN` | Token da football-data.org |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret interno para Edge Functions, nunca usar no frontend |
| `WORLD_NEWS_API_KEY` | Opcional; chave server-side para `news-proxy` |
| `WORLD_NEWS_URL` | Opcional; endpoint alternativo da API de noticias |

## Desenvolvimento local

```bash
git clone https://github.com/ojozinho/Bolao-Suprema.git
cd Bolao-Suprema
npm install
cp .env.example .env.local
npm run dev
```

Para desenvolvimento sem Supabase real:

```bash
VITE_MOCK_AUTH=true npm run dev
```

No Windows PowerShell:

```powershell
$env:VITE_MOCK_AUTH="true"
npm run dev
```

## Validacao local

```bash
npm run type-check
npm run build
```

## Deploy

O deploy e automatico via GitHub Actions em push para `main`.

- Workflow: `.github/workflows/deploy.yml`
- Output: `dist/`
- Publicacao: GitHub Pages
- URL: `https://bolao.suprema.group/`

## Checklist rapido para T.I.

- [ ] Conferir GitHub Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [ ] Conferir Supabase secret: `FOOTBALL_DATA_TOKEN`.
- [ ] Confirmar Edge Function `football-data-sync` com `verify_jwt=true`.
- [ ] Rodar `npm run type-check`.
- [ ] Rodar `npm run build`.
- [ ] Testar login OTP no GitHub Pages.
- [ ] Testar `/#/prediction`: salvar um jogo e salvar um grupo.
- [ ] Testar tentativa de alteracao apos bloquear mercado.
- [ ] Testar admin: bloquear/reabrir partida e apurar resultado.
- [ ] Rodar Supabase Security Advisor.
- [ ] Rodar Supabase Performance Advisor.

## Seguranca

- Nunca usar `service_role` no frontend.
- Nunca commitar `.env` ou tokens.
- RLS habilitado nas tabelas publicas.
- Views publicas com `security_invoker=true`.
- Trigger protege privilegios de usuario.
- Trigger bloqueia palpites fora do mercado aberto.
- Bucket `chat-media` nao permite listagem ampla de objetos.
- Secrets externos ficam em Supabase Edge Function secrets.

Mais detalhes: [docs/SECURITY.md](docs/SECURITY.md)

## Uso interno

Este repositorio e publico para viabilizar GitHub Pages. O acesso funcional depende de autenticacao corporativa e aprovacoes no Supabase. Nenhum token secreto deve estar no codigo-fonte.
