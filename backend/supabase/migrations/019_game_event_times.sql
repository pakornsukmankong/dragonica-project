-- Add an optional time-of-day to game events. The calendar itself stays
-- day-level (lane packing and the month grid still work off start_date /
-- end_date); the time is extra detail shown in the event's card and form.
-- Existing rows, and any event whose author leaves the time untouched, default
-- to 00:00 (midnight) — preserving the previous day-level behaviour.
alter table game_events
  add column if not exists start_time time not null default '00:00',
  add column if not exists end_time   time not null default '00:00';

-- Tighten the ordering check to the full start/end instant: on a single-day
-- event the end time must still be at or after the start time. (date + time
-- yields a timestamp, so this compares the whole moment, not just the day.)
alter table game_events drop constraint if exists game_events_date_order;
alter table game_events
  add constraint game_events_datetime_order
  check ((end_date + end_time) >= (start_date + start_time));
