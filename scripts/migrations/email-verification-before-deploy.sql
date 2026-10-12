-- Email verification at signup — run ONCE in phpMyAdmin BEFORE deploying.
--
-- Adds the confirmation columns to `users` and marks every existing account as
-- verified (they signed up before confirmation existed; locking them out now
-- would be wrong).
--
-- `email_verified_at` temporarily DEFAULTs to now, so any account created by
-- the code still live between this script and the deploy is also born
-- verified — the old code doesn't know the column and would otherwise leave it
-- NULL, which the new login refuses. The new code always writes NULL
-- explicitly. Run `email-verification-after-deploy.sql` once the deploy is up.

ALTER TABLE `users`
  ADD COLUMN `email_verified_at` datetime(3) NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  ADD COLUMN `email_verify_token_hash` varchar(64) NULL,
  ADD COLUMN `email_verify_expires_at` datetime(3) NULL;

-- Every row in the table right now predates confirmation: backdate them.
UPDATE `users` SET `email_verified_at` = `created_at`;

CREATE INDEX `users_email_verify_token_idx` ON `users` (`email_verify_token_hash`);
