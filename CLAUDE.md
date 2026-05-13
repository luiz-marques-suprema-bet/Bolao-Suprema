# CLAUDE.md — Bolão Suprema

Bolão oficial da Suprema Gaming para a Copa do Mundo 2026.
App web com ~300 participantes, hospedado em GitHub Pages.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS (tokens em `tailwind.config.ts`) |
| Animações | Framer Motion |
| Roteamento | React Router v6 (HashRouter — necessário para GitHub Pages) |
| Estado | Zustand (sem Redux) |
| Backend / DB | Supabase (PostgreSQL + Realtime + Storage) |
| Deploy | GitHub Actions → GitHub Pages |

## Estrutura

```
src/
  App.tsx              # Roteador principal (HashRouter)
  screens/             # Uma pasta por tela
    Home/              # Capa com highlights e notícias
    Boletim/           # Mural de comunicados (admin + marketing)
    Bracket/           # Chaveamento mata-mata
    Prediction/        # Fazer palpites de partidas
    Ranking/           # Classificação geral
    Resenha/           # Chat ao vivo com GIF e enquetes
    Profile/           # Perfil e configurações do usuário
    UserProfile/       # Ver perfil de outro usuário
    Admin/             # Painel admin (fechar partidas, registrar placares)
    Login/ Register/ Onboarding/
  stores/              # Zustand stores
    auth.store.ts      # Autenticação + perfil
    prediction.store.ts # Palpites + apostas gerais
    chat.store.ts      # Chat em tempo real + votos + pinning
    boletim.store.ts   # Boletins (Supabase + Realtime)
    bracket.store.ts   # Chaveamento
  lib/
    supabase.ts        # Client Supabase + uploadFile
    thesportsdb.ts     # Busca de jogadores (perfil)
    footballnews.ts    # Notícias Copa 2026 (Home)
    scorebat.ts        # Highlights de vídeo (Home)
    utils.ts           # cn, fmtPts, getInitials, AVATAR_COLORS, etc.
  components/
    navigation/        # MobileNav, DesktopNav
    shared/            # Logo, Avatar, Flag, Stamp, Marquee, etc.
  data/
    teams.ts           # 48 seleções da Copa 2026
    wc2026.ts          # Grupos e estrutura do torneio
    mock.ts            # Dados mock para desenvolvimento sem Supabase
  types/index.ts       # Todos os tipos TypeScript do projeto
  hooks/
    useBreakpoint.ts   # useIsDesktop()
```

## Variáveis de Ambiente

```env
# Obrigatórias para produção:
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Opcionais:
VITE_MOCK_AUTH=true               # Pula Supabase, usa dados mock (dev local)
VITE_TENOR_KEY=                   # GIFs na Resenha (sem chave = GIFs desabilitados)
VITE_THESPORTSDB_KEY=             # Busca jogadores (sem chave = usa chave free limitada)
VITE_FNEWS_URL=                   # API de notícias (sem chave = sem seção de notícias)
VITE_FNEWS_KEY=
VITE_FNEWS_HOST=
```

## Banco de Dados (Supabase)

Tabelas principais:
- `users` — perfis dos participantes. Campos: `is_admin`, `is_marketing`
- `matches` — calendário de partidas gerido pelo admin
- `predictions` — palpites de placar por usuário/partida
- `bracket_picks` — palpites de chaveamento
- `bulletins` — boletins do Boletim (escrita: admin + is_marketing)
- `chat_messages` — mensagens da Resenha
- `poll_votes` — votos em enquetes (persistidos separadamente)
- `channel_pins` — mensagem fixada por canal
- `ranking_snapshots` — snapshots de ranking (pts, acertos, exatos)

Schema completo e migrations: `supabase-schema.sql`

## Roles de Usuário

| Flag | Pode fazer |
|------|-----------|
| nenhuma | jogar, fazer palpites, usar o chat |
| `is_marketing = true` | publicar, fixar e excluir boletins |
| `is_admin = true` | tudo acima + abrir/fechar partidas, registrar placares, criar enquetes, fixar mensagens |

Para promover um usuário a marketing no Supabase:
```sql
update users set is_marketing = true where email = 'email@exemplo.com';
```

## Deploy

O deploy é automático via GitHub Actions ao fazer push para `main`.
Workflow em `.github/workflows/`. O build vai para a branch `gh-pages`.

## Desenvolvimento Local

```bash
npm install
cp .env.example .env.local   # preencher vars ou usar VITE_MOCK_AUTH=true
npm run dev
```

Com `VITE_MOCK_AUTH=true`, o app funciona sem Supabase usando dados de `src/data/mock.ts`.

## Convenções

- TypeScript estrito — sem `any` explícito
- Tailwind para estilos; sem CSS-in-JS na camada `src/`
- Stores Zustand: operações de DB são assíncronas com rollback em caso de erro
- Realtime Supabase: cada store gerencia seu próprio canal e faz `removeChannel` no destroy
- Imagens de usuário sobem para o bucket `user-media` no Supabase Storage
