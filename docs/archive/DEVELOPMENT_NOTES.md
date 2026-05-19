# Development Notes — Bolão Suprema

Arquivo legado preservado para referência técnica e auditoria interna.

Este conteúdo não faz parte do fluxo atual de build, deploy ou configuração de produção.

---

## Stack de referência (versão original)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS |
| Animações | Framer Motion |
| Roteamento | React Router v6 (HashRouter) |
| Estado | Zustand |
| Backend / DB | Supabase (PostgreSQL + Realtime + Storage) |
| Deploy | GitHub Actions → GitHub Pages |

## Estrutura de diretórios (versão original)

```
src/
  App.tsx
  screens/
  stores/
  lib/
  components/
  data/
  types/
  hooks/
```

## Variáveis de ambiente

Consultar `.env.example` para referência atualizada.

## Convenções

- TypeScript estrito.
- Tailwind para estilos.
- Stores Zustand com operações assíncronas e rollback em caso de erro.
- Realtime Supabase: cada store gerencia seu próprio canal.

## Documentação atualizada

A documentação técnica atual está em:

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
- `docs/SUPABASE_SETUP.md`
- `docs/TI_HANDOFF.md`
