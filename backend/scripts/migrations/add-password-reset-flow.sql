-- Add password reset flow persistence
-- 1) users.passwordChangedAt for token/session invalidation
-- 2) password_reset_tokens table for one-time reset links

ALTER TABLE users
ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tokenHash" VARCHAR(128) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "usedAt" TIMESTAMP NULL,
  "requestIp" VARCHAR(64) NULL,
  "requestUa" VARCHAR(512) NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id
  ON password_reset_tokens ("userId");

CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at
  ON password_reset_tokens ("expiresAt");
