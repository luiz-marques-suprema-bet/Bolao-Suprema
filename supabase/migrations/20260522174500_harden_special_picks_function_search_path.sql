-- Bolao Suprema - harden function search_path for special picks RPC.

alter function app_private.save_general_picks(text,text,text) set search_path = '';
alter function public.validate_general_picks() set search_path = '';
alter function public.save_general_picks(text,text,text) set search_path = '';
