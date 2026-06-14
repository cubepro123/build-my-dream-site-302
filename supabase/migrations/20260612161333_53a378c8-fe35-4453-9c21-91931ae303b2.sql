ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS shop_slug text,
  ADD COLUMN IF NOT EXISTS shop_bio text,
  ADD COLUMN IF NOT EXISTS shop_banner_url text,
  ADD COLUMN IF NOT EXISTS shop_logo_url text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_shop_slug_key
  ON public.profiles (lower(shop_slug)) WHERE shop_slug IS NOT NULL;

-- Make profiles publicly readable so shop pages work for signed-out users.
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

GRANT SELECT ON public.profiles TO anon;