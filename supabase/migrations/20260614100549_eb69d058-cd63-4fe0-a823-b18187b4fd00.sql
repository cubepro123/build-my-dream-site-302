ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_lat double precision,
  ADD COLUMN IF NOT EXISTS listing_lng double precision,
  ADD COLUMN IF NOT EXISTS listing_address text,
  ADD COLUMN IF NOT EXISTS listing_place_id text;

GRANT SELECT (listing_lat, listing_lng, listing_address, listing_place_id) ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE (listing_lat, listing_lng, listing_address, listing_place_id) ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;