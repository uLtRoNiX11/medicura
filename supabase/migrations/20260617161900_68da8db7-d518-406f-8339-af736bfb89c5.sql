
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  insurance_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- =========================
-- BILLS
-- =========================
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_url text,
  hospital_name text,
  total_amount numeric(12,2),
  plain_summary text,
  billing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  potential_savings numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bills_user_created_idx ON public.bills (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own bills" ON public.bills
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bills" ON public.bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bills" ON public.bills
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bills" ON public.bills
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- REMINDERS
-- =========================
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text,
  schedule_time time NOT NULL,
  days_of_week text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reminders_user_active_idx ON public.reminders (user_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own reminders" ON public.reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reminders" ON public.reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reminders" ON public.reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- REMINDER LOGS
-- =========================
CREATE TABLE public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reminder_logs_user_idx ON public.reminder_logs (user_id, taken_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own reminder logs" ON public.reminder_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reminder logs" ON public.reminder_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reminder logs" ON public.reminder_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- MEDICATIONS (public reference)
-- =========================
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  generic_equivalent text,
  average_cost numeric(10,2),
  cheaper_alternative text,
  alternative_cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX medications_name_idx ON public.medications (lower(name));

GRANT SELECT ON public.medications TO anon, authenticated;
GRANT ALL ON public.medications TO service_role;

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medications are publicly readable" ON public.medications
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.medications (name, generic_equivalent, average_cost, cheaper_alternative, alternative_cost) VALUES
  ('Lipitor', 'Atorvastatin', 180.00, 'Atorvastatin (generic)', 12.00),
  ('Nexium', 'Esomeprazole', 250.00, 'Omeprazole OTC', 18.00),
  ('Crestor', 'Rosuvastatin', 220.00, 'Rosuvastatin (generic)', 15.00),
  ('Advair Diskus', 'Fluticasone/Salmeterol', 380.00, 'Wixela Inhub (authorized generic)', 95.00),
  ('Synthroid', 'Levothyroxine', 50.00, 'Levothyroxine (generic)', 9.00);

-- =========================
-- CHAT THREADS / MESSAGES
-- =========================
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_threads_user_idx ON public.chat_threads (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own threads" ON public.chat_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own threads" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own threads" ON public.chat_threads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own threads" ON public.chat_threads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_thread_idx ON public.chat_messages (thread_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- TIMESTAMP TRIGGER
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_chat_threads_updated BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- HANDLE NEW USER -> profiles
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NULL))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- STORAGE: bills bucket policies
-- (bucket itself created via storage_create_bucket tool)
-- =========================
CREATE POLICY "Users read own bill files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own bill files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own bill files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own bill files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);
