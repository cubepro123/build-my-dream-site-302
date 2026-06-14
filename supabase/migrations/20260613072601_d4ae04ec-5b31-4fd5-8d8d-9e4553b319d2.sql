
CREATE TABLE public.seller_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rater_id, seller_id),
  CHECK (rater_id <> seller_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_ratings TO authenticated;
GRANT SELECT ON public.seller_ratings TO anon;
GRANT ALL ON public.seller_ratings TO service_role;

ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by everyone"
  ON public.seller_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own ratings"
  ON public.seller_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rater_id AND rater_id <> seller_id);

CREATE POLICY "Users can update their own ratings"
  ON public.seller_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can delete their own ratings"
  ON public.seller_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);

CREATE TRIGGER update_seller_ratings_updated_at
BEFORE UPDATE ON public.seller_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX seller_ratings_seller_idx ON public.seller_ratings (seller_id);
