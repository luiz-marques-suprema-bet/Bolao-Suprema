# Bolao Suprema

Aplicacao web interna da Suprema para palpites da Copa do Mundo FIFA 2026.

## Estado atual

O Bolao Suprema e uma SPA React/Vite publicada no GitHub Pages em `https://bolao.suprema.group/`. Autenticacao, banco, RLS, realtime, storage, cron, Edge Functions, pontuacao e auditoria rodam no Supabase.

Validacao operacional mais recente: 2026-06-01.

- Copa 2026 modelada com 48 selecoes, 12 grupos, 104 partidas e Fase de 32.
- Palpites fecham automaticamente por `kickoff_utc`; o banco bloqueia insert/update fora do mercado aberto.
- Salvamento jogo a jogo, em lote por grupo e apostas especiais confirmam somente depois de resposta do Supabase.
- Pontuacao e ranking sao calculados no Supabase quando resultados sao apurados.
- Sync externo de placares roda por `football-data-sync` + pg_cron.
- Mata-mata materializa automaticamente da Fase de 32 ate final, com fallback admin.
- Noticias da Copa passam por `news-proxy`; sem chave paga, usa Google News RSS server-side.
- Avisos e alertas de palpites perto de fechar aparecem no sininho do app.
- CI e deploy rodam no GitHub Actions em push para `main`.

## Funcionalidades

- Login por OTP com e-mail corporativo `@suprema.group`.
- Perfil de participante com foto, banner, bio, selecao e jogador favorito.
- Palpites de placar por partida.
- Salvamento em lote por grupo.
- Apostas especiais: campeao, vice e artilheiro.
- Travamento automatico por kickoff e status de mercado.
- Ranking geral e detalhamento de pontos.
- Resenha: chat com texto, imagem, GIF, audio e enquetes.
- Boletim: comunicados internos para admin/marketing.
- Avisos globais e sininho de alertas.
- Painel admin para operacao, participantes, papeis, comunicacao, saude e auditoria.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS |
| Animacoes | Framer Motion |
| Rotas | React Router v6 com HashRouter |
| Estado | Zustand |
| Backend | Supabase PostgreSQL, Auth, Realtime, Storage |
| Automacao | Supabase Edge Functions + pg_cron |
| Deploy | GitHub Actions + GitHub Pages |

## Fluxo de palpites

1. Usuario autenticado acessa `/#/prediction`.
2. Ajusta placares jogo a jogo ou salva um grupo inteiro.
3. O frontend so marca como salvo depois de confirmacao do Supabase.
4. O banco valida usuario ativo, partida real, mercado aberto e `kickoff_utc > now()`.
5. Depois do kickoff, a trigger `trg_predictions_market_open` impede alteracao mesmo por API direta.

RPCs principais:

- `public.save_match_predictions(jsonb)`
- `public.save_general_picks(text,text,text)`
- `public.ensure_prediction_market_open()`

## Automacao

- `football-data-sync`: sincroniza placares e status da football-data.org.
- Cron `football-data-sync`: agenda a Edge Function periodicamente pelo Supabase.
- `close_expired_markets()`: fecha mercados expirados.
- `settle_match_result()`: registra placar, apura pontos e atualiza ranking.
- `materialize_knockout()`: preenche a fase eliminatoria conforme resultados reais.

O admin continua existindo como fallback operacional: bloquear/reabrir mercados, corrigir resultados, definir classificados manualmente e revisar auditoria.

## Supabase

Projeto atual:

- Ref: `mklmnxquvslflgljhgqn`
- Regiao: `us-east-1`

Migrations ficam em [supabase/migrations](supabase/migrations).

Edge Functions:

| Function | JWT | Funcao |
|----------|-----|--------|
| `football-data-sync` | `true` | sincroniza football-data.org |
| `news-proxy` | `true` | proxy server-side de noticias da Copa |

Documentos tecnicos:

- [docs/TI_HANDOFF.md](docs/TI_HANDOFF.md)
- [docs/WC2026_FORMAT.md](docs/WC2026_FORMAT.md)
- [docs/FOOTBALL_DATA_SYNC.md](docs/FOOTBALL_DATA_SYNC.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)

## Variaveis e secrets

### Frontend / GitHub Actions

Somente chaves publicas/publishable entram em `VITE_*`.

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL publica do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | Anon/publishable key do Supabase |
| `VITE_TENOR_KEY` | Nao | GIFs da Resenha |
| `VITE_THESPORTSDB_KEY` | Nao | Busca de jogadores |
| `VITE_MOCK_AUTH` | Nao | `true` apenas para desenvolvimento local |

Noticias da Copa 2026 nao usam chave `VITE_*`. O frontend chama apenas `news-proxy`.

### Supabase secrets

| Secret | Descricao |
|--------|-----------|
| `FOOTBALL_DATA_TOKEN` | Token da football-data.org |
| `SUPABASE_SERVICE_ROLE_KEY` | Uso interno de Edge Functions |
| `WORLD_NEWS_API_KEY` | Opcional; chave paga server-side para noticias |
| `WORLD_NEWS_URL` | Opcional; endpoint alternativo da API de noticias |

Sem `WORLD_NEWS_API_KEY`, `news-proxy` usa fallback server-side via Google News RSS.

## Desenvolvimento local

```bash
git clone https://github.com/luiz-marques-suprema-bet/Bolao-Suprema.git
cd Bolao-Suprema
npm install
cp .env.example .env.local
npm run dev
```

PowerShell com mock local:

```powershell
$env:VITE_MOCK_AUTH="true"
npm run dev
```

## Validacao

```bash
npm run type-check
npm test
npm run build
```

Checklist rapido antes de publicar:

- [ ] GitHub Actions verdes em `main`.
- [ ] `football-data-sync` ativo e com HTTP 200 recente.
- [ ] `news-proxy` retorna noticias sem expor chave no bundle.
- [ ] Login OTP funcionando em producao.
- [ ] Palpite salvo e bloqueio por kickoff/mercado testados.
- [ ] Admin consegue bloquear/reabrir mercado e apurar resultado.
- [ ] Security Advisor e Performance Advisor revisados.

## Seguranca

- Nunca usar `service_role` no frontend.
- Nunca commitar `.env` ou tokens.
- RLS habilitado nas tabelas publicas.
- RPCs administrativas checam admin/owner no banco.
- Trigger bloqueia palpites fora do mercado aberto.
- Buckets de midia nao permitem listagem ampla.
- Secrets externos ficam em Supabase Edge Function secrets.

Este repositorio e publico para viabilizar GitHub Pages. O acesso funcional ao bolao depende de autenticacao corporativa e permissoes no Supabase.
