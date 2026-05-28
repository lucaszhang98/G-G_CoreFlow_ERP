ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "write_off" BOOLEAN NOT NULL DEFAULT false;
