-- Reliable notification delivery state. A row can be claimed by only one
-- worker at a time, stale claims can be recovered, and retry scheduling is
-- persisted across backend restarts.
ALTER TABLE "NotificationOutbox"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lockedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lockToken" TEXT,
  ADD COLUMN "providerMessageId" TEXT;

UPDATE "NotificationOutbox"
   SET "idempotencyKey" = 'notification-' || "id"::text,
       "nextAttemptAt" = "createdAt";

ALTER TABLE "NotificationOutbox"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "nextAttemptAt" SET NOT NULL,
  ALTER COLUMN "nextAttemptAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "NotificationOutbox"
  ADD CONSTRAINT "NotificationOutbox_attempts_nonnegative_check" CHECK ("attempts" >= 0);

CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key"
  ON "NotificationOutbox"("idempotencyKey");

CREATE INDEX "NotificationOutbox_actionable_nextAttemptAt_idx"
  ON "NotificationOutbox"("nextAttemptAt", "id")
  WHERE "status" = 'PENDING';

CREATE INDEX "NotificationOutbox_lockToken_idx"
  ON "NotificationOutbox"("lockToken")
  WHERE "lockToken" IS NOT NULL;

-- Protect against duplicate active late alerts when multiple backend
-- instances evaluate the same trip concurrently.
CREATE UNIQUE INDEX "LateAlert_one_active_per_trip_key"
  ON "LateAlert"("tripId")
  WHERE "status" = 'ACTIVE';
