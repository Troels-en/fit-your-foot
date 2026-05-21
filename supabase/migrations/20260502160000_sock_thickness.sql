-- Sock-Thickness-Tracking für Photogrammetry-Scans.
--
-- User trägt eine gemusterte Socke beim Scan (oder ist barfuß). Wenn Socke
-- an, gibt User die Dicke an: dünn (~1mm), mittel (~3mm), dick (~6mm).
-- Server subtrahiert 2× sock_thickness_mm von foot_width / heel_width / ball_width
-- und 1× von foot_toebox_height bei der Mesh→Maße-Extraktion.
--
-- NULL = Default für alle Pre-Photogrammetry-Scans (alter 2-Foto-Flow).
-- 0 = explizit barfuß gescannt.

alter table public.scans
  add column if not exists sock_thickness_mm smallint;

comment on column public.scans.sock_thickness_mm is 'Sock-Dicke beim Scan in mm. NULL = unbekannt (alter Flow), 0 = barfuß, 1/3/6 = dünn/mittel/dick.';
