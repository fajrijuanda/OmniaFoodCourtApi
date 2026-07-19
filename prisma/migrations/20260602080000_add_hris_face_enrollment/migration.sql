ALTER TABLE "employees"
  ADD COLUMN "face_photo_url" TEXT,
  ADD COLUMN "face_embedding" JSONB,
  ADD COLUMN "face_enrolled_at" TIMESTAMP(3),
  ADD COLUMN "liveness_challenge" TEXT,
  ADD COLUMN "liveness_expires_at" TIMESTAMP(3);
