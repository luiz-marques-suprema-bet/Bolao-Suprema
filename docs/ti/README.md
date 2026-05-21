# Guia rapido de T.I. - Bolao Suprema

Este arquivo e o checklist curto. O handoff completo esta em [../TI_HANDOFF.md](../TI_HANDOFF.md).

## O que o app faz

- Bolao interno da Suprema para Copa 2026.
- Login por OTP com e-mail `@suprema.group`.
- Palpites por jogo e por grupo.
- Ranking, Resenha, Boletim, notificacoes e painel admin.
- Sync esportivo via football-data.org usando Supabase Edge Function.

## Pontos que T.I. deve saber

- O usuario nao depende do admin para palpitar.
- A tela admin e apenas para operacao e correcao.
- O usuario pode editar palpite ate o kickoff da partida.
- A trava principal esta no banco, nao so no frontend.
- Service role nunca deve ir para frontend ou GitHub Actions.
- `FOOTBALL_DATA_TOKEN` fica somente em Supabase secrets.

## Projeto Supabase

- Ref: `mklmnxquvslflgljhgqn`
- Edge Function: `football-data-sync`
- JWT da Edge Function: deve ficar habilitado (`verify_jwt=true`)

## Secrets

### GitHub Actions

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Edge Function

- `FOOTBALL_DATA_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY` (secret interno do Supabase)

## Migrations importantes desta fase

- `20260521103000_prediction_batch_and_football_data.sql`
- `20260521110000_restrict_rpc_grants.sql`
- `20260521110500_harden_chat_media_listing.sql`

## Validacao tecnica

```bash
npm install
npm run type-check
npm run build
```

## Validacao funcional

- [ ] Login OTP funciona.
- [ ] Usuario novo entra pendente.
- [ ] Admin aprova usuario.
- [ ] Usuario salva um palpite individual.
- [ ] Usuario salva um grupo inteiro.
- [ ] Mercado bloqueado impede alteracao.
- [ ] Resultado apurado atualiza ranking.
- [ ] Resenha funciona em duas abas.
- [ ] Upload de avatar/banner funciona.
- [ ] `football-data-sync?season=2026` retorna JSON sem erro de token.

## Resultado esperado do sync

Um retorno valido tem este formato:

```json
{
  "ok": true,
  "competition": "WC",
  "season": "2026",
  "updated": 63,
  "unmatched": []
}
```

`unmatched` pode vir preenchido enquanto fases futuras ainda nao tiverem times definidos. Isso nao bloqueia a fase de grupos.

## Security Advisor

Depois das migrations, rodar Supabase Security Advisor.

Aceitavel para seguir:

- Sem RPC administrativa executavel por `anon`.
- Sem bucket publico com listagem ampla.
- RLS ativo nas tabelas publicas.
- Views publicas com `security_invoker=true`.

Avisos comuns que exigem decisao operacional:

- `authenticated_security_definer_function_executable`: esperado para algumas RPCs chamadas pelo app, desde que elas validem admin/owner internamente.
- `auth_leaked_password_protection`: ativar pelo dashboard se o plano/politica permitir.

## Links

- README principal: [../../README.md](../../README.md)
- Handoff completo: [../TI_HANDOFF.md](../TI_HANDOFF.md)
- Sync football-data: [../FOOTBALL_DATA_SYNC.md](../FOOTBALL_DATA_SYNC.md)
- Seguranca: [../SECURITY.md](../SECURITY.md)
