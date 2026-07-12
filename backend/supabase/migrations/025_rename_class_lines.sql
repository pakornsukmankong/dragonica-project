-- Rename job paths (display names only). Slugs stay the same, so build URLs
-- and share links are unaffected.
--   id 23: Monk → Priest → Cleric              becomes Acolyte → Oracle → Cleric
--   id 25: Pathfinder → Ranger → Sentinel      becomes Hunter → Trapper → Sentinel
--   id 26: Arbalist → Grenadier → Bombardier   becomes Ranger → Ballista → Bombardier
update skill_classes set name = 'Acolyte → Oracle → Cleric' where id = 23;
update skill_classes set name = 'Hunter → Trapper → Sentinel' where id = 25;
update skill_classes set name = 'Ranger → Ballista → Bombardier' where id = 26;
