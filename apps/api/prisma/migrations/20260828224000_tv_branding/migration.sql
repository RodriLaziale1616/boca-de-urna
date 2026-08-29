ALTER TABLE "Election"
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "brandSubtitle" TEXT,
  ADD COLUMN "brandLogoData" TEXT,
  ADD COLUMN "brandPrimaryColor" TEXT NOT NULL DEFAULT '#C4161C',
  ADD COLUMN "brandSecondaryColor" TEXT NOT NULL DEFAULT '#111318',
  ADD COLUMN "brandBackgroundColor" TEXT NOT NULL DEFAULT '#080A0D',
  ADD COLUMN "brandSurfaceColor" TEXT NOT NULL DEFAULT '#15181E',
  ADD COLUMN "brandTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN "tvTickerText" TEXT,
  ADD COLUMN "tvPublicEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tvAccessToken" TEXT,
  ADD COLUMN "tvShowClock" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tvShowTotal" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tvShowUpdatedAt" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Election_tvAccessToken_key" ON "Election"("tvAccessToken");
