-- Rename the Archer (id 25) job path: Pathfinder → Ranger → Sentinel becomes
-- Hunter → Trapper → Sentinel. The slug stays 'sentinel', so build URLs and
-- share links are unaffected.
update skill_classes set name = 'Hunter → Trapper → Sentinel' where id = 25;
