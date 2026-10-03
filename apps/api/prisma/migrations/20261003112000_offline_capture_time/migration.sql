ALTER TABLE "Vote" ADD COLUMN "capturedAt" TIMESTAMP(3);

CREATE INDEX "Vote_electionId_capturedAt_idx"
ON "Vote"("electionId", "capturedAt");
