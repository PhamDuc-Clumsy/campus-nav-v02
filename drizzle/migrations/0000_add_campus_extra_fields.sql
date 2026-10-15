ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.waypoints ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.path_segments ADD COLUMN IF NOT EXISTS distance real;
ALTER TABLE public.map_settings ADD COLUMN IF NOT EXISTS canvas_width integer NOT NULL DEFAULT 1000;
ALTER TABLE public.map_settings ADD COLUMN IF NOT EXISTS canvas_height integer NOT NULL DEFAULT 720;
