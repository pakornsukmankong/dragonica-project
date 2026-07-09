-- Dragon Saga (Landverse / spidpex) job-path names for the 8 skill classes.
-- (Fresh installs get these from 013; this updates existing rows.)
update skill_classes set name = 'Knight → Paladin → Dragoon',        slug = 'dragoon'       where id = 21;
update skill_classes set name = 'Gladiator → Myrmidon → Berserker',  slug = 'berserker'     where id = 22;
update skill_classes set name = 'Monk → Priest → Cleric',            slug = 'cleric'        where id = 23;
update skill_classes set name = 'Battlemage → Archmage → Chaosmage', slug = 'chaosmage'     where id = 24;
update skill_classes set name = 'Pathfinder → Ranger → Sentinel',    slug = 'sentinel'      where id = 25;
update skill_classes set name = 'Arbalist → Grenadier → Bombardier', slug = 'bombardier'    where id = 26;
update skill_classes set name = 'Jester → Harlequin → Joker',        slug = 'joker'         where id = 27;
update skill_classes set name = 'Assassin → Ninja → Shadow Walker',  slug = 'shadow-walker' where id = 28;
