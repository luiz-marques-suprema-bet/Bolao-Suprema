# Deploy — Bolão Suprema

## Visão geral

O deploy é automático via GitHub Actions. A cada push para `main`, o workflow executa o build e publica o artefato na branch `gh-pages`, que é servida pelo GitHub Pages.

URL de produção: `https://bolao.suprema.group/`

## Variáveis de ambiente no GitHub

Acessar: Repositório > Settings > Secrets and variables > Actions > Repository secrets

| Secret | Valor |
|--------|-------|
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable do Supabase |

As demais variáveis de ambiente opcionais (Tenor, TheSportsDB, Football News) podem ser adicionadas da mesma forma se necessário.

## Workflow de deploy

Arquivo: `.github/workflows/deploy.yml`

Etapas:
1. Checkout do repositório.
2. Setup do Node 20.
3. Instalação de dependências com `npm ci`.
4. Build com `npm run build` (injeta as variáveis de ambiente dos secrets).
5. Publicação do diretório `dist/` na branch `gh-pages` via `peaceiris/actions-gh-pages`.

## Build local

```bash
npm ci
npm run build
```

O artefato é gerado em `dist/`. Para inspecionar antes de publicar:

```bash
npm run preview
```

## Configuração do GitHub Pages

1. Repositório > Settings > Pages.
2. Source: `Deploy from a branch`.
3. Branch: `gh-pages`, pasta: `/ (root)`.
4. Salvar.

## Configuração do Supabase para o domínio de produção

No Supabase Dashboard > Authentication > URL Configuration:

| Campo | Valor |
|-------|-------|
| Site URL | `https://bolao.suprema.group` |
| Redirect URLs | `https://bolao.suprema.group/**` |

Sem essa configuração, o redirecionamento após OTP não funciona.

## Base path no Vite

O `vite.config.ts` deve ter `base: '/'` porque o app é servido na raiz do domínio customizado `bolao.suprema.group`. Se voltar para o subpath do GitHub Pages, restaurar o base path antigo.

## Checklist pós-deploy

- [ ] Acessar `https://bolao.suprema.group/` e verificar carregamento.
- [ ] Testar login com OTP.
- [ ] Verificar rota `/#/home`, `/#/prediction`, `/#/ranking`.
- [ ] Verificar que `/#/admin` exige perfil de admin.
- [ ] Confirmar que assets (flags, ícones) carregam corretamente.
- [ ] Confirmar que Supabase Realtime conecta (indicador de chat ativo).
- [ ] Verificar console do browser — sem erros críticos de rede ou CORS.

## Rollback

Para reverter para a versão anterior:

1. Identificar o commit anterior em `main` via `git log`.
2. Fazer push de um novo commit revertendo as mudanças (preferível a reescrever o histórico).
3. O workflow fará o redeploy automaticamente.

Alternativa rápida: no GitHub Actions, re-executar o workflow de um run anterior bem-sucedido.

## Variáveis opcionais

| Variável | Funcionalidade afetada se ausente |
|----------|----------------------------------|
| `VITE_TENOR_KEY` | GIFs na Resenha ficam desabilitados |
| `VITE_THESPORTSDB_KEY` | Busca de jogador usa chave free (rate-limited) |

Noticias da Copa 2026 nao usam mais chave `VITE_*` no frontend. Opcionalmente configure a chave paga como secret da Edge Function `news-proxy`:

```bash
supabase secrets set WORLD_NEWS_API_KEY=your-world-news-api-key
supabase functions deploy news-proxy
```

Sem esse secret, o proxy usa fallback server-side via Google News RSS.
