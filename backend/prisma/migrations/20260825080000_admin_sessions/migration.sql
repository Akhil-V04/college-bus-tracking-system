CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "adminIdentifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSession_adminIdentifier_revokedAt_expiresAt_idx"
ON "AdminSession"("adminIdentifier", "revokedAt", "expiresAt");
