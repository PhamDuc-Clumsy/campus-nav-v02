CREATE TABLE public.floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor integer NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, floor)
);
GRANT SELECT ON public.floor_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floor_plans TO authenticated;
GRANT ALL ON public.floor_plans TO service_role;
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views floor plans" ON public.floor_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert floor plans" ON public.floor_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update floor plans" ON public.floor_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete floor plans" ON public.floor_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read floor-plans files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'floor-plans');
CREATE POLICY "Admins upload floor-plans files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update floor-plans files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete floor-plans files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));
