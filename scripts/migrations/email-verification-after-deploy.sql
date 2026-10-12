-- Email verification at signup — run in phpMyAdmin AFTER the deploy is live.
--
-- Drops the temporary default from the before-deploy script so the column
-- matches src/lib/db/schema.ts (new signups start unverified; the code already
-- inserts NULL explicitly, so this only tidies the schema).

ALTER TABLE `users` ALTER COLUMN `email_verified_at` DROP DEFAULT;
