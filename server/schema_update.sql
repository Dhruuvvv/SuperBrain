-- ============================================================
-- SUPERBRAIN AUTH UPGRADE MIGRATION
-- ============================================================
-- Apply this script in your Supabase SQL Editor.
-- It sets up a secure database trigger to automatically create 
-- profile rows and updates RLS policies on the profiles table.
-- ============================================================

-- 1. Create a function to handle profile creation automatically on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger to execute after a user is inserted in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Ensure Row Level Security (RLS) is enabled on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Allow anyone to view profiles
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
CREATE POLICY "Allow public read access" ON public.profiles
    FOR SELECT USING (true);

-- 5. RLS Policy: Allow users to insert their own profile (Trigger handles this securely, but client fallback is allowed)
DROP POLICY IF EXISTS "Allow individual insert" ON public.profiles;
CREATE POLICY "Allow individual insert" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. RLS Policy: Allow users to update only their own profile
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
CREATE POLICY "Allow individual update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 7. RLS Policy: Allow users to delete only their own profile
DROP POLICY IF EXISTS "Allow individual delete" ON public.profiles;
CREATE POLICY "Allow individual delete" ON public.profiles
    FOR DELETE USING (auth.uid() = id);
