-- Usage survives conversation cleanup; ownership is checked by reserve_ai_question.
-- Failed in-flight work can still refund its reservation if the conversation disappears.
alter table public.ai_question_requests drop constraint ai_question_requests_conversation_id_fkey;
