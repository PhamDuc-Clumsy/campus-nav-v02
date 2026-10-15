/*
# Create full campus navigation database schema

This migration creates the complete database backing the FPT Hoa Lac campus
navigation app. The database was previously empty.

## New Tables
1. `buildings` — Campus buildings. Columns: id, name, vi, category, x, y, description, floors, image_url.
2. `waypoints` — Road/path network nodes. Columns: id, x, y, kind, label.
3. `path_segments` — Edges connecting waypoints with vehicle flags. Columns: id, a, b, flags, distance.
4. `map_settings` — Single-row (id=1) map background config. Columns: id, image_path, scale, offset_x, offset_y, opacity, canvas_width, canvas_height, updated_at.
5. `rooms` — Rooms inside buildings. Columns: id, building_id, floor, name, code, kind, created_at.
6. `floor_plans` — Blueprint images per building+floor. Columns: id, building_id, floor, image_url, created_at. Unique (building_id, floor).
7. `user_roles` — Maps auth users to roles. Columns: user_id, role, created_at. PK (user_id, role).

## Functions
1. `has_role(uuid, text)` — Checks if a user has a given role. SECURITY DEFINER.
2. `claim_first_admin()` — First authenticated caller becomes admin. SECURITY DEFINER.

## Security
- RLS on all tables. Public SELECT on campus data tables. Admin-only writes via has_role check.
- user_roles: users can only SELECT their own rows.
- Storage buckets campus-maps and floor-plans: public read, admin-only write.
*/

-- ===== TABLES =====

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.buildings (
  id text PRIMARY KEY,
  name text NOT NULL,
  vi text NOT NULL,
  category text NOT NULL DEFAULT 'amenity',
  x real NOT NULL DEFAULT 0,
  y real NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  floors integer,
  image_url text
);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.waypoints (
  id text PRIMARY KEY,
  x real NOT NULL,
  y real NOT NULL,
  kind text NOT NULL DEFAULT 'road',
  label text
);
ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.path_segments (
  id text PRIMARY KEY,
  a text NOT NULL REFERENCES public.waypoints(id) ON DELETE CASCADE,
  b text NOT NULL REFERENCES public.waypoints(id) ON DELETE CASCADE,
  flags text[] NOT NULL DEFAULT '{}',
  distance real
);
ALTER TABLE public.path_segments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.map_settings (
  id integer PRIMARY KEY DEFAULT 1,
  image_path text,
  scale real NOT NULL DEFAULT 1,
  offset_x real NOT NULL DEFAULT 0,
  offset_y real NOT NULL DEFAULT 0,
  opacity real NOT NULL DEFAULT 0.8,
  canvas_width integer NOT NULL DEFAULT 1000,
  canvas_height integer NOT NULL DEFAULT 720,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  code text,
  kind text NOT NULL DEFAULT 'room',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_building_idx ON public.rooms(building_id);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor integer NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, floor)
);
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

-- ===== FUNCTIONS =====

CREATE OR REPLACE FUNCTION public.has_role(target_user uuid, role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user AND role = role_name
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_admin_count integer;
  current_uid uuid := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT count(*) INTO existing_admin_count FROM public.user_roles WHERE role = 'admin';
  IF existing_admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (current_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- ===== GRANTS =====
GRANT SELECT ON public.buildings, public.waypoints, public.path_segments, public.map_settings, public.rooms, public.floor_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.buildings, public.waypoints, public.path_segments, public.map_settings, public.rooms, public.floor_plans TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.buildings, public.waypoints, public.path_segments, public.map_settings, public.rooms, public.floor_plans, public.user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- ===== POLICIES =====

DROP POLICY IF EXISTS "select_own_roles" ON public.user_roles;
CREATE POLICY "select_own_roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "public_read_buildings" ON public.buildings;
CREATE POLICY "public_read_buildings" ON public.buildings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_buildings" ON public.buildings;
CREATE POLICY "admin_insert_buildings" ON public.buildings FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_buildings" ON public.buildings;
CREATE POLICY "admin_update_buildings" ON public.buildings FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_buildings" ON public.buildings;
CREATE POLICY "admin_delete_buildings" ON public.buildings FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_waypoints" ON public.waypoints;
CREATE POLICY "public_read_waypoints" ON public.waypoints FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_waypoints" ON public.waypoints;
CREATE POLICY "admin_insert_waypoints" ON public.waypoints FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_waypoints" ON public.waypoints;
CREATE POLICY "admin_update_waypoints" ON public.waypoints FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_waypoints" ON public.waypoints;
CREATE POLICY "admin_delete_waypoints" ON public.waypoints FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_path_segments" ON public.path_segments;
CREATE POLICY "public_read_path_segments" ON public.path_segments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_path_segments" ON public.path_segments;
CREATE POLICY "admin_insert_path_segments" ON public.path_segments FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_path_segments" ON public.path_segments;
CREATE POLICY "admin_update_path_segments" ON public.path_segments FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_path_segments" ON public.path_segments;
CREATE POLICY "admin_delete_path_segments" ON public.path_segments FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_map_settings" ON public.map_settings;
CREATE POLICY "public_read_map_settings" ON public.map_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_map_settings" ON public.map_settings;
CREATE POLICY "admin_update_map_settings" ON public.map_settings FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_rooms" ON public.rooms;
CREATE POLICY "public_read_rooms" ON public.rooms FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_rooms" ON public.rooms;
CREATE POLICY "admin_insert_rooms" ON public.rooms FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_rooms" ON public.rooms;
CREATE POLICY "admin_update_rooms" ON public.rooms FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_rooms" ON public.rooms;
CREATE POLICY "admin_delete_rooms" ON public.rooms FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_floor_plans" ON public.floor_plans;
CREATE POLICY "public_read_floor_plans" ON public.floor_plans FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_floor_plans" ON public.floor_plans;
CREATE POLICY "admin_insert_floor_plans" ON public.floor_plans FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_floor_plans" ON public.floor_plans;
CREATE POLICY "admin_update_floor_plans" ON public.floor_plans FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_floor_plans" ON public.floor_plans;
CREATE POLICY "admin_delete_floor_plans" ON public.floor_plans FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== STORAGE =====
INSERT INTO storage.buckets (id, name, public) VALUES ('campus-maps', 'campus-maps', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "public_read_campus_maps" ON storage.objects;
CREATE POLICY "public_read_campus_maps" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'campus-maps');
DROP POLICY IF EXISTS "admin_upload_campus_maps" ON storage.objects;
CREATE POLICY "admin_upload_campus_maps" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'campus-maps' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_campus_maps" ON storage.objects;
CREATE POLICY "admin_update_campus_maps" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'campus-maps' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_campus_maps" ON storage.objects;
CREATE POLICY "admin_delete_campus_maps" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'campus-maps' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public_read_floor_plans_storage" ON storage.objects;
CREATE POLICY "public_read_floor_plans_storage" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'floor-plans');
DROP POLICY IF EXISTS "admin_upload_floor_plans_storage" ON storage.objects;
CREATE POLICY "admin_upload_floor_plans_storage" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_update_floor_plans_storage" ON storage.objects;
CREATE POLICY "admin_update_floor_plans_storage" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin_delete_floor_plans_storage" ON storage.objects;
CREATE POLICY "admin_delete_floor_plans_storage" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'floor-plans' AND public.has_role(auth.uid(), 'admin'));

-- ===== SEED DATA =====

INSERT INTO public.map_settings (id, image_path, scale, offset_x, offset_y, opacity, canvas_width, canvas_height)
VALUES (1, NULL, 1, 0, 0, 0.8, 1000, 720)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buildings (id, name, vi, category, x, y, description) VALUES
  ('alpha', 'Alpha Building', 'Tòa Alpha', 'lecture', 470, 300, 'Iconic dragon‑wave main hall: administration, library and lecture rooms.'),
  ('beta', 'Beta Building', 'Tòa Beta', 'lecture', 640, 250, 'Lecture halls and labs for engineering and IT programs.'),
  ('gamma', 'Gamma Building', 'Tòa Gamma', 'lecture', 700, 400, 'Classrooms, student services and event hall.'),
  ('delta', 'Delta Building', 'Tòa Delta', 'lecture', 560, 470, 'New lecture building with modern seminar rooms.'),
  ('doma', 'Dorm A', 'Dom A', 'dorm', 150, 170, 'Student dormitory A.'),
  ('domb', 'Dorm B', 'Dom B', 'dorm', 230, 130, 'Student dormitory B.'),
  ('domc', 'Dorm C', 'Dom C', 'dorm', 310, 110, 'Student dormitory C.'),
  ('domd', 'Dorm D', 'Dom D', 'dorm', 130, 270, 'Student dormitory D.'),
  ('dome', 'Dorm E', 'Dom E', 'dorm', 210, 320, 'Student dormitory E.'),
  ('domf', 'Dorm F', 'Dom F', 'dorm', 130, 380, 'Student dormitory F.'),
  ('domg', 'Dorm G', 'Dom G', 'dorm', 220, 430, 'Student dormitory G.'),
  ('lake', 'Lotus Lake', 'Hồ Sen', 'amenity', 420, 470, 'Lotus lake at the campus heart — a favourite spot for a walk.'),
  ('vovinam', 'Vovinam Dojo', 'Võ đường Vovinam', 'amenity', 820, 300, 'Training hall for the compulsory Vovinam martial arts course.'),
  ('sports', 'Sports Field', 'Khu thể thao / Sân bóng đá', 'amenity', 820, 560, 'Football pitch, courts and outdoor sports area.'),
  ('canteen', 'Canteen & 7‑Eleven', 'Canteen & 7‑Eleven', 'amenity', 330, 250, 'Main canteen and convenience store near the dorms.'),
  ('parking', 'Parking', 'Bãi xe', 'amenity', 470, 620, 'Motorbike and car parking by the main gate.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.waypoints (id, x, y, kind) VALUES
  ('g', 470, 680, 'road'),
  ('r1', 470, 560, 'road'),
  ('r2', 470, 400, 'road'),
  ('r3', 470, 200, 'road'),
  ('r4', 330, 200, 'road'),
  ('r5', 180, 220, 'road'),
  ('r6', 180, 350, 'road'),
  ('r7', 180, 480, 'road'),
  ('r8', 330, 380, 'road'),
  ('r9', 620, 330, 'road'),
  ('r10', 760, 330, 'road'),
  ('r11', 760, 480, 'road'),
  ('r12', 620, 560, 'road'),
  ('r13', 760, 620, 'road'),
  ('r14', 620, 200, 'road')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.path_segments (id, a, b, flags) VALUES
  ('g-r1', 'g', 'r1', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r1-r2', 'r1', 'r2', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r2-r3', 'r2', 'r3', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r3-r4', 'r3', 'r4', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r4-r5', 'r4', 'r5', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r5-r6', 'r5', 'r6', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r6-r7', 'r6', 'r7', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r6-r8', 'r6', 'r8', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r8-r2', 'r8', 'r2', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r4-r8', 'r4', 'r8', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r2-r9', 'r2', 'r9', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r9-r10', 'r9', 'r10', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r10-r11', 'r10', 'r11', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r11-r12', 'r11', 'r12', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r12-r1', 'r12', 'r1', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r11-r13', 'r11', 'r13', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r12-r13', 'r12', 'r13', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r3-r14', 'r3', 'r14', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r14-r9', 'r14', 'r9', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route']),
  ('r7-r1', 'r7', 'r1', ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route'])
ON CONFLICT (id) DO NOTHING;