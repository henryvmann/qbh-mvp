-- Oracle table for the call-test harness. test-loop writes the
-- expected outcome BEFORE the call (the date Sandra is scripted to
-- offer, the scenario name, the persona, etc.); test-analyze reads it
-- AFTER the call to grade date_accuracy against the booked
-- calendar_event. Without an oracle the rubric can only judge
-- behavior, not whether Kate booked the date the receptionist meant.

create table if not exists call_test_oracles (
  vapi_call_id text primary key,
  attempt_id text,
  scenario text not null,            -- e.g. "Friendly / dow_dom_match / new_patient_paperwork_first"
  base_persona text,
  edge_case text,
  date_pattern text,                 -- which DATE_TRICKINESS key was used
  intended_iso timestamptz,          -- the date Sandra was scripted to offer
  intended_phrase text,              -- the exact spoken phrasing
  is_regression boolean default false,
  created_at timestamptz default now()
);

create index if not exists call_test_oracles_attempt_idx
  on call_test_oracles(attempt_id);
