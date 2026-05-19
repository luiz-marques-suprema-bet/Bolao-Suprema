-- Add reply_to column to chat_messages for WhatsApp-style quoted replies.
-- Stores a JSONB snapshot: { id, who, text, type } — no FK needed.
alter table public.chat_messages
  add column if not exists reply_to jsonb;
