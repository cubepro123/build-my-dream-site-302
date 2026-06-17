-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. Feature flags
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  bool_value boolean,
  num_value numeric,
  text_value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flags" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage flags" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.feature_flags (key, bool_value) VALUES ('boost_enabled', false);
INSERT INTO public.feature_flags (key, num_value) VALUES ('boost_price_per_view_ngn', 2);
INSERT INTO public.feature_flags (key, num_value) VALUES ('boost_max_duration_days', 7);

-- 3. Boost columns on listings
ALTER TABLE public.listings
  ADD COLUMN boost_status text NOT NULL DEFAULT 'none',
  ADD COLUMN boost_views_purchased integer NOT NULL DEFAULT 0,
  ADD COLUMN boost_views_delivered integer NOT NULL DEFAULT 0,
  ADD COLUMN boost_started_at timestamptz,
  ADD COLUMN boost_expires_at timestamptz;

-- 4. Boost orders
CREATE TABLE public.boost_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  views integer NOT NULL CHECK (views > 0),
  amount_naira numeric NOT NULL CHECK (amount_naira > 0),
  paystack_reference text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT, INSERT ON public.boost_orders TO authenticated;
GRANT ALL ON public.boost_orders TO service_role;
ALTER TABLE public.boost_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own orders" ON public.boost_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own orders" ON public.boost_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Account deletion tokens
CREATE TABLE public.account_deletion_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_deletion_tokens TO authenticated;
GRANT ALL ON public.account_deletion_tokens TO service_role;
ALTER TABLE public.account_deletion_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own deletion tokens" ON public.account_deletion_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 6. Seed bolkerbino26@gmail.com as admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'bolkerbino26@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;