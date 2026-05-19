# Segurança — Bolão Suprema

## Modelo de autenticação

O app usa autenticação por OTP (código de uso único) enviado por e-mail via Supabase Auth. Não há senhas armazenadas. O e-mail deve pertencer ao domínio `@suprema.group`.

Após autenticar, o usuário recebe um JWT assinado pelo Supabase. Esse token é enviado automaticamente em cada requisição ao banco e ao storage. O Supabase valida o token e aplica as políticas de Row Level Security antes de executar qualquer operação.

## Por que o repositório pode ser público

O repositório é público para viabilizar o deploy via GitHub Pages. Os controles abaixo mitigam o risco associado a essa exposição:

1. Nenhuma credencial real (chave de serviço, senha, token de API sensível) está presente no código-fonte.
2. A chave presente no front-end (`VITE_SUPABASE_ANON_KEY`) é a chave anon/publishable, projetada para uso público e protegida por RLS.
3. A autorização efetiva está no banco de dados, não no código JavaScript — o front-end aplica validações de UX, não de segurança.

## Chaves do Supabase

| Tipo | Local | Pode ser pública? |
|------|-------|-------------------|
| `anon` / publishable | Front-end via `VITE_SUPABASE_ANON_KEY` | Sim, quando protegida por RLS |
| `service_role` | Apenas scripts de setup administrativo, nunca no front-end | Nunca |

A chave `service_role` bypassa toda a RLS. Ela jamais deve aparecer no código-fonte ou em commits.

## Row Level Security (RLS)

RLS está habilitado em todas as tabelas expostas no schema `public`. As políticas seguem o princípio de menor privilégio:

- Usuários só leem/escrevem os próprios dados onde aplicável.
- Dados de outros usuários são acessíveis apenas onde a feature exige (ranking, chat, perfis públicos).
- Perfis marcados como privados (`privacy_hide_profile = true`) não são visíveis para outros usuários comuns — apenas o próprio dono e admins.
- Ações de admin (abrir/fechar mercados, registrar resultados, moderar chat, gerenciar participantes) são restritas por verificação de `is_admin` ou `is_owner` dentro de RPCs com `security definer`.

## RPCs administrativas

Ações sensíveis são encapsuladas em funções PostgreSQL (RPCs) com:

- `security definer` — executam com permissões do criador, não do chamador.
- `set search_path = public` — evita injeção de schema.
- Verificação interna de `public.is_admin(auth.uid())` ou `public.is_owner(auth.uid())`.
- Registro em `audit_logs` para rastreabilidade.
- `revoke execute from public, anon` — apenas `authenticated` pode chamar.

RPCs existentes: `set_match_market_status`, `settle_match_result`, `refresh_ranking_snapshots`, `moderate_chat_message`, `update_participant_status`.

## Proteção contra autoelevação de privilégios e alteração de identidade

As migrations `20260519090000` e `20260519100000` implementam e estendem o trigger `BEFORE UPDATE` na tabela `users`. O controle impede que usuários comuns alterem os seguintes campos via API direta:

- `email` — identidade vinculada ao Supabase Auth e ao domínio corporativo
- `is_admin`, `is_owner`, `is_marketing`
- `user_role`
- `participant_status`, `approved_at`, `approved_by`, `blocked_at`, `removed_at`

O front-end não envia esses campos no update de perfil. O trigger aplica a restrição no banco como segunda camada de controle, independente do comportamento da aplicação.

## Proteção contra palpites fora do prazo

A migration `20260519091000_enforce_prediction_market_lock.sql` substitui o trigger `ensure_prediction_market_open` com uma versão mais robusta. Palpites não podem ser criados ou alterados quando:

- `market_status <> 'open'`
- `status` da partida é `locked`, `live` ou `finished`
- `kickoff_utc` já passou

A verificação de mercado no front-end (`isBetOpen`) melhora a experiência do usuário, mas a regra definitiva é a trigger no banco.

## Storage

Os buckets de armazenamento (`avatars`, `banners`, `bulletins`, `chat-media`) têm:

- Limite de tamanho: 5 MB para fotos/banners, 8 MB para imagens de chat, 10 MB para áudio.
- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif` para imagens; `audio/webm`, `audio/ogg`, `audio/mp4` para áudio.
- Caminhos controlados por `userId` — usuários não podem sobrescrever arquivos de outros.
- Listagem de bucket desabilitada (migration `20260515144500`).

## XSS

- O app não usa `dangerouslySetInnerHTML`.
- Todo conteúdo de usuário (bio, chat, nomes) é renderizado como texto pelo React.
- URLs de mídia externa (GIFs, imagens de chat) são validadas por `isSafeHttpUrl` em `src/lib/security.ts`, que aceita apenas `https://`.
- URLs de perfil externo (jogador favorito) vêm da TheSportsDB e não são renderizadas como HTML.

## GitHub Secret Scanning

O repositório público está sujeito ao GitHub Secret Scanning, que detecta padrões de chaves conhecidas (Supabase, AWS, etc.) em commits. Se uma chave vazar:

1. Revogar imediatamente no provedor (Supabase Dashboard > Settings > API).
2. Rotacionar a chave.
3. Remover do histórico Git se necessário (`git filter-repo` ou BFG).
4. Verificar logs de acesso no Supabase.
5. Abrir registro interno de incidente.

Para evitar vazamentos acidentais:

- `.env` e `.env.local` estão no `.gitignore`.
- `.env.example` contém apenas valores de placeholder.
- Nunca commitar arquivos com credenciais reais.

## O que fazer se uma chave vazar

1. Revogar imediatamente no provedor.
2. Rotacionar a chave e atualizar o secret no GitHub (Settings > Secrets and variables > Actions).
3. Remover a chave do código-fonte e dos commits afetados.
4. Reescrever o histórico Git se a chave aparecer em commits antigos.
5. Verificar logs de acesso no Supabase (Dashboard > Logs).
6. Abrir registro interno de incidente e notificar o responsável técnico.

## Processo de resposta a incidente

| Severidade | Exemplos | Ação imediata |
|------------|---------|---------------|
| Crítica | service_role key exposta, RLS desabilitado | Revogar chave, colocar app offline, notificar T.I. |
| Alta | Usuário conseguiu virar admin, palpite após kickoff | Corrigir trigger/RLS, auditar logs, notificar T.I. |
| Média | Upload de arquivo fora do allowlist | Aplicar fix no storage, revisar bucket policies |
| Baixa | Erro de validação de front-end | Corrigir na próxima release |
