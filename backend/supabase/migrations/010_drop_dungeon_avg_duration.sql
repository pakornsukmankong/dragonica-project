-- Remove the unused average_duration column from dungeons.
alter table dungeons drop column if exists average_duration;
