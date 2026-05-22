# Formato Copa do Mundo 2026

Referencia operacional usada pelo Bolao Suprema.

## Estrutura oficial

- 48 selecoes.
- 12 grupos de 4 selecoes.
- 72 partidas na fase de grupos.
- Classificam 32 selecoes para o mata-mata:
  - 1o e 2o colocados de cada grupo: 24 selecoes;
  - 8 melhores 3os colocados: 8 selecoes.
- Mata-mata:
  - Fase de 32: 16 jogos;
  - Oitavas de final: 8 jogos;
  - Quartas de final: 4 jogos;
  - Semifinais: 2 jogos;
  - Disputa de 3o lugar: 1 jogo;
  - Final: 1 jogo.
- Total do torneio: 104 partidas.

## Datas de referencia

- Abertura/fase de grupos: 11 Jun 2026.
- Encerramento da fase de grupos: 27 Jun 2026.
- Fase de 32: a partir de 28 Jun 2026.
- Oitavas: a partir de 4 Jul 2026.
- Quartas: a partir de 9 Jul 2026.
- Semifinais: a partir de 14 Jul 2026.
- 3o lugar: 18 Jul 2026.
- Final: 19 Jul 2026.

## Impacto no sistema

- Nao tratar "oitavas" como primeira fase eliminatoria.
- Qualquer resumo visual do chaveamento deve comecar em "Fase de 32".
- A classificacao projetada na fase de grupos deve destacar:
  - os dois primeiros como classificados diretos;
  - o terceiro colocado como candidato ao ranking dos melhores terceiros.
- O app pode manter palpites da fase de grupos separados dos palpites do mata-mata.
- O mata-mata deve permanecer fechado ate os confrontos estarem definidos.

## Implementacao atual

- `src/data/wc2026.ts` exporta 72 jogos de grupos e 32 placeholders de mata-mata, totalizando 104 partidas.
- `src/lib/bracket2026.ts` deriva os slots do bracket diretamente dos jogos eliminatorios, evitando bracket permanente em `mock.ts`.
- No banco, `public.matches` foi atualizado para manter 104 registros operacionais.
- `public.markets` guarda mercados de jogo e especiais com `opens_at`, `closes_at`, `status` e `lock_reason`.
- Jogos de mata-mata entram como `locked` enquanto os classificados reais nao estiverem definidos.
- Apostas especiais usam `public.special_picks` e a RPC `save_general_picks`, com deadline server-side.

## Limites conhecidos

- A distribuicao oficial completa dos confrontos da fase de 32 ainda depende da combinacao real dos 8 melhores terceiros. Enquanto isso, os jogos eliminatorios ficam como placeholders bloqueados.
- O cadastro oficial completo de jogadores para validar artilheiro ainda nao esta modelado; hoje o servidor valida prazo, participante ativo e tamanho do nome.
- Advisors do Supabase ainda apontam RPCs admin `SECURITY DEFINER` expostas a `authenticated`; elas validam admin/owner internamente, mas a remocao total do warning exige mover essas operacoes para schema privado ou Edge Functions administrativas.

## Fontes

- FIFA: formato da fase de grupos e criterio de classificacao.
- FIFA: calendario oficial de partidas da Copa do Mundo 2026.
