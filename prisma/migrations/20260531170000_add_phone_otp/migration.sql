ALTER TABLE "users"
  ADD COLUMN "phone_number" TEXT,
  ADD COLUMN "phone_verified_at" TIMESTAMP(3);

CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'register',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "verified_at" TIMESTAMP(3),
  "consumed_at" TIMESTAMP(3),
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_challenges_phone_number_purpose_created_at_idx"
  ON "otp_challenges"("phone_number", "purpose", "created_at");
