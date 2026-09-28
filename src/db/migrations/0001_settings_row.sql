-- The settings table always has exactly one row (id = 1).
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
