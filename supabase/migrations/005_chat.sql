CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat" ON chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
