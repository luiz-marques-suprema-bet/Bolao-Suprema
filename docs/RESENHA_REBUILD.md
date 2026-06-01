# Resenha - nova estrutura de chat

## Objetivo

A Resenha foi reconstruida para funcionar como um grupo moderno, com mensagens persistidas no Supabase e eventos em tempo real. A regra de produto e: mensagem, resposta, enquete, anexo, audio, video circular e reacao precisam ser independentes entre si, sem depender de tela admin para operar.

## Referencias tecnicas usadas

- Supabase Realtime: Postgres Changes para mensagens, enquetes, pinos e reacoes.
- Supabase Presence: usuarios online e indicador de digitacao.
- Supabase Storage com RLS: upload restrito ao proprio usuario em `chat-media`.
- Padroes de grupo estilo WhatsApp/Telegram: resposta, mencao, reacao, enquete, foto, audio e video note.

## Contrato de banco

Migration: `supabase/migrations/20260521153000_rebuild_resenha_chat.sql`

Ela adiciona em `public.chat_messages`:

- `media_url`, `media_kind`, `media_mime`, `media_size`, `media_duration`, `media_thumbnail_url`
- `mentions uuid[]`
- `edited_at`, `updated_at`
- tipos aceitos: `text`, `gif`, `poll`, `image`, `audio`, `video`, `video_note`

Ela cria:

- `public.chat_message_reactions`
- RLS para leitura por autenticados, inserir propria reacao e remover propria reacao/admin
- publicacao Realtime para `chat_message_reactions`
- bucket/policies de `chat-media` com imagens, audio e video ate 25 MB

## Frontend

Arquivos principais:

- `src/stores/chat.store.ts`: store unica da Resenha, carregamento inicial, Presence, Realtime, envio e acoes.
- `src/screens/ResenhaV2/index.tsx`: orquestracao da tela.
- `src/screens/ResenhaV2/components/ChatComposer.tsx`: texto, mencoes, GIF, foto, audio, video e video circular.
- `src/screens/ResenhaV2/components/ReactionStrip.tsx`: reacoes por usuario.
- `src/screens/ResenhaV2/components/VideoBubble.tsx`: video normal e video circular.

## Passo para aplicar no Supabase

Execute no Supabase SQL Editor:

```sql
-- aplicar exatamente o conteudo de:
-- supabase/migrations/20260521153000_rebuild_resenha_chat.sql
```

Depois, validar:

```sql
select count(*) from public.chat_message_reactions;
select type, count(*) from public.chat_messages group by type order by type;
select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'chat-media';
```

## Observacoes para TI

- Nenhuma chave sensivel fica no repositorio.
- A tabela de reacoes e normalizada para permitir varias pessoas reagindo a mesma mensagem.
- Digitacao e online nao gravam historico no banco; usam Presence, que e efemero por design.
- Upload de midia segue RLS no Storage. O caminho usado e `chat/<tipo>/<user_id>/<timestamp>.<ext>`.
- A tela admin continua podendo moderar, mas o chat nao depende dela para operar.
