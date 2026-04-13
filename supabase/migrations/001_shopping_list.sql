-- Shopping List tables and RLS policies

CREATE TABLE shopping_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shopping_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC DEFAULT 1,
  unit TEXT,
  category TEXT,
  is_checked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shopping_lists_user_id ON shopping_lists(user_id);
CREATE INDEX idx_shopping_items_list_id ON shopping_items(list_id);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- Application Security Requirement: RLS policies enforce user-level data isolation
CREATE POLICY "Users can manage own lists"
  ON shopping_lists FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage items in own lists"
  ON shopping_items FOR ALL
  USING (list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()))
  WITH CHECK (list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
