-- Optional family display name, separate from the primary guardian's name.
-- With two guardians per family, "the family" needs its own label (e.g.
-- "The Parker Family"). NULL falls back to the primary guardian's name
-- everywhere, so existing families are unaffected.

ALTER TABLE guardians
  ADD COLUMN family_name text;
