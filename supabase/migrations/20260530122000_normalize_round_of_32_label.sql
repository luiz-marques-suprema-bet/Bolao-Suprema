-- ============================================================================
-- Bolao Suprema · M5/M10 remediation · padroniza label da Fase de 32
-- ----------------------------------------------------------------------------
-- A migration 20260522024500 semeou os 16 jogos da primeira fase eliminatoria
-- com stage_label = '32 AVOS · N'. O app usa "FASE DE 32" (src/data/wc2026.ts),
-- e a decisao editorial do projeto e usar "FASE DE 32" em app e banco. Isto
-- normaliza qualquer label '32 AVOS%' remanescente no banco.
--
-- Idempotente: so altera linhas que ainda contem o termo antigo.
-- ============================================================================

update public.matches
set stage_label = replace(stage_label, '32 AVOS', 'FASE DE 32')
where stage_label like '%32 AVOS%';
