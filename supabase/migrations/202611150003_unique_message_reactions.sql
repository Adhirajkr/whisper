-- Ensure each signed-in user can keep one reaction per message.
create unique index if not exists reactions_message_user_unique
  on public.reactions(message_id,user_id);
