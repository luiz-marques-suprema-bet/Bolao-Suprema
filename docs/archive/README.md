# Arquivos legados

Esta pasta contém arquivos antigos preservados temporariamente para referência técnica e auditoria interna.

Eles não fazem parte do fluxo atual de build, deploy, configuração do Supabase ou publicação em produção.

Antes de reutilizar qualquer arquivo desta pasta, validar manualmente se ele ainda é compatível com as migrations atuais em `supabase/migrations/`.

## Conteúdo

| Arquivo | Origem | Observação |
|---------|--------|-----------|
| `migrate-v3-legacy.sql` | Raiz do repositório | Migration manual antiga — substituída pelas migrations em `supabase/migrations/` |
| `migrate-v4-legacy.sql` | Raiz do repositório | Migration manual antiga — substituída pelas migrations em `supabase/migrations/` |
| `migrate-v5-legacy.sql` | Raiz do repositório | Migration manual antiga — substituída pelas migrations em `supabase/migrations/` |
| `supabase-setup-legacy.js` | Raiz do repositório | Script de setup automatizado legado — não usar em produção |
| `supabase-setup-legacy.cjs` | Raiz do repositório | Script de setup automatizado legado — não usar em produção |
| `DEVELOPMENT_NOTES.md` | Raiz do repositório | Notas técnicas internas de desenvolvimento |
