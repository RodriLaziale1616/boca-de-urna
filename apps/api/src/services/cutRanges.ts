import { Prisma } from "@prisma/client";
import { prisma } from "../db";

export type CutRangeRow = {
  hourLabel: string;
  candidateId: string;
  count: bigint;
};

export async function getCutRangeRows(
  electionId: string,
  timezone: string,
  pollingPlaceId?: string
) {
  const placeFilter = pollingPlaceId
    ? Prisma.sql`AND "pollingPlaceId" = ${pollingPlaceId}`
    : Prisma.empty;

  return prisma.$queryRaw<CutRangeRow[]>(Prisma.sql`
    WITH localized AS (
      SELECT
        "candidateId",
        ((COALESCE("capturedAt", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) AS "localTime"
      FROM "Vote"
      WHERE "electionId" = ${electionId}
      ${placeFilter}
    ),
    bucketed AS (
      SELECT
        "candidateId",
        CASE
          WHEN "localTime"::time >= TIME '07:00' AND "localTime"::time < TIME '09:00' THEN '07 a 09'
          WHEN "localTime"::time >= TIME '09:00' AND "localTime"::time < TIME '12:00' THEN '09 a 12'
          WHEN "localTime"::time >= TIME '12:00' AND "localTime"::time < TIME '14:00' THEN '12 a 14'
          WHEN "localTime"::time >= TIME '14:00' AND "localTime"::time < TIME '16:00' THEN '14 a 16'
          ELSE NULL
        END AS "hourLabel",
        CASE
          WHEN "localTime"::time >= TIME '07:00' AND "localTime"::time < TIME '09:00' THEN 1
          WHEN "localTime"::time >= TIME '09:00' AND "localTime"::time < TIME '12:00' THEN 2
          WHEN "localTime"::time >= TIME '12:00' AND "localTime"::time < TIME '14:00' THEN 3
          WHEN "localTime"::time >= TIME '14:00' AND "localTime"::time < TIME '16:00' THEN 4
          ELSE NULL
        END AS "cutOrder"
      FROM localized
    )
    SELECT
      "hourLabel",
      "candidateId",
      COUNT(*)::bigint AS "count"
    FROM bucketed
    WHERE "hourLabel" IS NOT NULL
    GROUP BY "cutOrder", "hourLabel", "candidateId"
    ORDER BY "cutOrder" ASC
  `);
}
