-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "electionDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Asuncion',
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "resetDelaySeconds" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollingPlace" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PollingPlace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedElectionId" TEXT,
    "pollingPlaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listLabel" TEXT,
    "party" TEXT,
    "ballotNumber" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#D96570',
    "isNoResponse" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "pollingPlaceId" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Vote_requestId_key" ON "Vote"("requestId");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- Query indexes
CREATE INDEX "User_role_assignedElectionId_idx" ON "User"("role", "assignedElectionId");
CREATE INDEX "Election_status_idx" ON "Election"("status");
CREATE INDEX "Candidate_electionId_active_sortOrder_idx" ON "Candidate"("electionId", "active", "sortOrder");
CREATE INDEX "PollingPlace_electionId_active_idx" ON "PollingPlace"("electionId", "active");
CREATE INDEX "Vote_electionId_createdAt_idx" ON "Vote"("electionId", "createdAt");
CREATE INDEX "Vote_electionId_candidateId_idx" ON "Vote"("electionId", "candidateId");
CREATE INDEX "Vote_electionId_operatorId_idx" ON "Vote"("electionId", "operatorId");
CREATE INDEX "Vote_pollingPlaceId_idx" ON "Vote"("pollingPlaceId");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_assignedElectionId_fkey" FOREIGN KEY ("assignedElectionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollingPlace" ADD CONSTRAINT "PollingPlace_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Votes are append-only at database level. This protects the survey ledger from
-- accidental application mutations; schema resets/migrations can still recreate it.
CREATE OR REPLACE FUNCTION "prevent_vote_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Vote records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Vote_immutable_trigger"
BEFORE UPDATE OR DELETE ON "Vote"
FOR EACH ROW EXECUTE FUNCTION "prevent_vote_mutation"();
