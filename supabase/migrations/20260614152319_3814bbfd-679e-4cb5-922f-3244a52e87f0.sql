CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT, phone TEXT, whatsapp TEXT, location TEXT, avatar_url TEXT,
  shop_name text, shop_slug text, shop_bio text, shop_banner_url text, shop_logo_url text,
  shop_type TEXT CHECK (shop_type IN ('marketplace','services')),
  shop_lat double precision, shop_lng double precision, shop_address text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_shop_slug_key ON public.profiles (lower(shop_slug)) WHERE shop_slug IS NOT NULL;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, whatsapp)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'phone', NEW.raw_user_meta_data ->> 'whatsapp');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SSP',
  category TEXT NOT NULL, condition TEXT NOT NULL DEFAULT 'used',
  location TEXT NOT NULL, phone TEXT, whatsapp TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  listing_lat double precision, listing_lng double precision, listing_address text, listing_place_id text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_created_idx ON public.listings (created_at DESC);
CREATE INDEX listings_category_idx ON public.listings (category);
CREATE INDEX listings_seller_idx ON public.listings (seller_id);
GRANT SELECT (id, seller_id, title, description, price, currency, category, condition, location, images, status, listing_lat, listing_lng, listing_address, listing_place_id, created_at, updated_at) ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings are viewable by everyone" ON public.listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id);
CREATE POLICY "Authenticated can create listing" ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller can update own listing" ON public.listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Seller can delete own listing" ON public.listings FOR DELETE USING (auth.uid() = seller_id);
CREATE TRIGGER listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);
CREATE INDEX conversations_buyer_idx ON public.conversations (buyer_id);
CREATE INDEX conversations_seller_idx ON public.conversations (seller_id);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversation" ON public.conversations FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyer can create conversation" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update conversation" ON public.conversations FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id), CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON public.user_blocks FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a));
$$;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated, anon, service_role;

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at timestamptz,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
CREATE INDEX messages_conv_read_idx ON public.messages (conversation_id, read_at);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
      AND NOT public.is_blocked_between(c.buyer_id, c.seller_id)
  )
);
CREATE POLICY "Recipient can mark as read" ON public.messages FOR UPDATE
  USING (auth.uid() <> sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())))
  WITH CHECK (auth.uid() <> sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END; $$;
CREATE TRIGGER messages_touch_conv AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);
CREATE INDEX favorites_user_id_idx ON public.favorites(user_id);
CREATE INDEX favorites_listing_id_idx ON public.favorites(listing_id);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL, details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_id)
);
GRANT SELECT, INSERT ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own reports" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view own reports" ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE TABLE public.seller_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rater_id, seller_id), CHECK (rater_id <> seller_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_ratings TO authenticated;
GRANT SELECT ON public.seller_ratings TO anon;
GRANT ALL ON public.seller_ratings TO service_role;
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings are viewable by everyone" ON public.seller_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own ratings" ON public.seller_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id AND rater_id <> seller_id);
CREATE POLICY "Users can update their own ratings" ON public.seller_ratings FOR UPDATE TO authenticated USING (auth.uid() = rater_id) WITH CHECK (auth.uid() = rater_id);
CREATE POLICY "Users can delete their own ratings" ON public.seller_ratings FOR DELETE TO authenticated USING (auth.uid() = rater_id);
CREATE TRIGGER update_seller_ratings_updated_at BEFORE UPDATE ON public.seller_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX seller_ratings_seller_idx ON public.seller_ratings (seller_id);

CREATE POLICY "Listing images public read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
CREATE POLICY "Auth can upload listing images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can update listing images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners can delete listing images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat-attach upload own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat-attach read participants" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'chat-attachments' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id::text = (storage.foldername(name))[2] AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
  )
);
CREATE POLICY "chat-attach delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "shop_logos_read_all" ON storage.objects FOR SELECT TO authenticated, anon USING (bucket_id = 'shop-logos');
CREATE POLICY "shop_logos_owner_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "shop_logos_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shop-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "shop_logos_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shop-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_conversation() FROM PUBLIC, anon, authenticated;