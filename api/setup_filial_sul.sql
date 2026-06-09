-- ============================================================
-- SETUP COMPLETO - FILIAL SUL
-- ============================================================
-- Execute este script no SQL Editor do seu novo projeto Supabase
-- da Filial Sul para criar toda a estrutura do banco de dados.
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  company_name TEXT NOT NULL DEFAULT 'Eletromidia Sul',
  avatar TEXT,
  team_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, company_id, company_name, avatar)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'),
    'internal',
    'Eletromidia Sul',
    new.raw_user_meta_data->>'avatar'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  company_id TEXT DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  asset_json JSONB NOT NULL,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  technician_id TEXT NOT NULL, 
  leader_id TEXT NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  scheduled_date TEXT NOT NULL,
  description TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  blocking_reason TEXT,
  not_performed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_id UUID REFERENCES auth.users(id),
  technician_ids TEXT[] NOT NULL DEFAULT '{}',
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TASK EVIDENCES TABLE
CREATE TABLE IF NOT EXISTS task_evidences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION
);

-- 6. CHAT SYSTEM
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. OPEC MANAGEMENT
CREATE TABLE IF NOT EXISTS opec_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS opec_management (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opec_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assignment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. EMPLOYEE INVITES
CREATE TABLE IF NOT EXISTS employee_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  company_name TEXT NOT NULL DEFAULT 'Eletromidia Sul',
  shift TEXT,
  code TEXT,
  leader_name TEXT,
  original_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. DAILY REPORTS & ABSENCES
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  evidence_url TEXT,
  notes TEXT,
  technician_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  vehicle_plate TEXT,
  opec_code TEXT,
  technician_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT,
  employee_name TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  company_id TEXT NOT NULL DEFAULT 'internal',
  evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  tag TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_control (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'CHECKIN' or 'CHECKOUT'
  kms DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  evidence_url TEXT,
  checklist JSONB,
  notes TEXT
);

-- 11. MEASUREMENT PRICES
CREATE TABLE IF NOT EXISTS measurement_prices (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  item_code TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. MEASUREMENTS
CREATE TABLE IF NOT EXISTS asset_measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  company_id TEXT NOT NULL DEFAULT 'internal',
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  items_snapshot JSONB NOT NULL DEFAULT '[]',
  total_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('absences', 'absences', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-reports', 'daily-reports', true) ON CONFLICT (id) DO NOTHING;

-- 15. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 16. SIMPLIFIED POLICIES (Everyone in company 'internal' can see everything)
CREATE POLICY "Profiles viewable by internal" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Assets viewable by authenticated users" ON assets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Tasks viewable by internal" ON tasks FOR SELECT USING (true);
CREATE POLICY "Management can manage tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Teams viewable by internal" ON teams FOR SELECT USING (true);
CREATE POLICY "Evidence viewable by internal" ON task_evidences FOR SELECT USING (true);

-- Chat Policies
CREATE POLICY "Users can see their conversations" ON chat_conversations FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users can see messages in their conversations" ON chat_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = chat_messages.conversation_id AND auth.uid() = ANY(c.participants)));
CREATE POLICY "Users can send messages to their conversations" ON chat_messages FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = chat_messages.conversation_id AND auth.uid() = ANY(c.participants)));

-- Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'assets', 'absences', 'daily-reports'));

DROP POLICY IF EXISTS "User Upload" ON storage.objects;
CREATE POLICY "User Upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 17. REALTIME
-- (Run manually in SQL Editor)
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE teams;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
