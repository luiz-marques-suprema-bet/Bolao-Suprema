-- Remove default public/anon execute grants from product write RPCs.

revoke execute on function public.save_prediction(text,integer,integer) from public, anon;
revoke execute on function public.save_general_picks(text,text,text) from public, anon;
revoke execute on function public.save_bracket_pick(text,text,text) from public, anon;
revoke execute on function public.delete_bracket_pick(text) from public, anon;
revoke execute on function public.create_participant_invite(text,integer,timestamptz) from public, anon;
revoke execute on function public.save_scoring_rule(text,text,text,text,integer,integer,boolean) from public, anon;

grant execute on function public.save_prediction(text,integer,integer) to authenticated;
grant execute on function public.save_general_picks(text,text,text) to authenticated;
grant execute on function public.save_bracket_pick(text,text,text) to authenticated;
grant execute on function public.delete_bracket_pick(text) to authenticated;
grant execute on function public.create_participant_invite(text,integer,timestamptz) to authenticated;
grant execute on function public.save_scoring_rule(text,text,text,text,integer,integer,boolean) to authenticated;
