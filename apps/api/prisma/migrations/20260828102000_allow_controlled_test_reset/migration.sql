-- Keep votes immutable during normal operation, but allow a narrowly scoped
-- DELETE only inside an administrator-controlled reset transaction.
CREATE OR REPLACE FUNCTION "prevent_vote_mutation"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.allow_test_reset', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Vote records are immutable';
END;
$$ LANGUAGE plpgsql;
