ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own" ON leads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "leads_insert_own" ON leads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "leads_update_own" ON leads
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "leads_delete_own" ON leads
  FOR DELETE USING (user_id = auth.uid());
