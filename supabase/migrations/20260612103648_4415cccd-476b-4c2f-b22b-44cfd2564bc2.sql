
CREATE POLICY "Listing images public read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
CREATE POLICY "Auth can upload listing images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Owners can update listing images" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Owners can delete listing images" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text
);
