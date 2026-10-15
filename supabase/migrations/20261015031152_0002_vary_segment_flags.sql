/*
# Vary road segment flags for transportation visualization

All 20 road segments previously had the same 4 flags (accessible_ramp,
motor_allowed, car_allowed, bus_route), so switching transportation modes
showed no visual difference on the map. This migration updates the flags
to create realistic variation:

- Main roads (g-r1, r1-r2, r2-r3, r2-r9): all vehicles allowed
- Ring roads (r9-r10, r10-r11, r11-r12, r12-r1): motor + car + bus, accessible
- Dorm spur roads (r4-r5, r5-r6, r6-r7, r7-r1): walk + motor only, walk_only segments
- Inner paths (r6-r8, r8-r2, r4-r8): walk_only (pedestrian shortcuts)
- Bus-only spur (r11-r13, r12-r13): bus route + accessible, no motor/car
- North connector (r3-r14, r14-r9): motor + car, accessible, no bus
- Walk-only paths added where appropriate

This makes the white/grey visualization meaningful when switching between
walk, motor, car, bus, and wheelchair.
*/

UPDATE public.path_segments SET flags = ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route'] WHERE id IN ('g-r1', 'r1-r2', 'r2-r3', 'r2-r9');
UPDATE public.path_segments SET flags = ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route'] WHERE id IN ('r9-r10', 'r10-r11', 'r11-r12', 'r12-r1');
UPDATE public.path_segments SET flags = ARRAY['motor_allowed', 'accessible_ramp'] WHERE id IN ('r4-r5', 'r5-r6', 'r6-r7', 'r7-r1');
UPDATE public.path_segments SET flags = ARRAY['walk_only'] WHERE id IN ('r6-r8', 'r8-r2', 'r4-r8');
UPDATE public.path_segments SET flags = ARRAY['accessible_ramp', 'bus_route'] WHERE id IN ('r11-r13', 'r12-r13');
UPDATE public.path_segments SET flags = ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed'] WHERE id IN ('r3-r14', 'r14-r9');
UPDATE public.path_segments SET flags = ARRAY['accessible_ramp', 'motor_allowed', 'car_allowed', 'bus_route'] WHERE id IN ('r3-r4');