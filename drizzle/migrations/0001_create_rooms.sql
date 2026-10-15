CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  code text,
  kind text NOT NULL DEFAULT 'room',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_building_idx ON public.rooms(building_id);
GRANT SELECT ON public.rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update rooms" ON public.rooms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete rooms" ON public.rooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS floors integer;
