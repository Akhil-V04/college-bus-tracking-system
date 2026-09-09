-- Preserve optional device-quality metadata for GPS validation and diagnostics.
ALTER TABLE "LiveLocation"
ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN "deviceSpeedKmh" DOUBLE PRECISION;

ALTER TABLE "LiveLocation"
ADD CONSTRAINT "LiveLocation_accuracyMeters_check"
CHECK ("accuracyMeters" IS NULL OR "accuracyMeters" >= 0),
ADD CONSTRAINT "LiveLocation_deviceSpeedKmh_check"
CHECK ("deviceSpeedKmh" IS NULL OR "deviceSpeedKmh" >= 0);

CREATE INDEX "LiveLocation_tripId_deviceTimestamp_idx"
ON "LiveLocation"("tripId", "deviceTimestamp");

-- A driver device timestamp identifies one sample within a trip. This makes
-- reconnect retries idempotent while still allowing devices that omit time.
CREATE UNIQUE INDEX "LiveLocation_one_device_sample_per_trip"
ON "LiveLocation"("tripId", "deviceTimestamp")
WHERE "deviceTimestamp" IS NOT NULL;
