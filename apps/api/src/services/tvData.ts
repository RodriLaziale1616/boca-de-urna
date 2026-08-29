import { Prisma } from "@prisma/client";
import { prisma } from "../db";

export async function getTvDataByElection(electionId: string) {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return null;

  const [candidates, total, grouped] = await Promise.all([
    prisma.candidate.findMany({
      where: { electionId: election.id },
      orderBy: [{ isNoResponse: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.vote.count({ where: { electionId: election.id } }),
    prisma.vote.groupBy({
      by: ["candidateId"],
      where: { electionId: election.id },
      _count: { _all: true }
    })
  ]);

  const countMap = new Map(grouped.map(group => [group.candidateId, group._count._all]));
  const candidateResults = candidates
    .filter(candidate => candidate.active || (countMap.get(candidate.id) ?? 0) > 0)
    .map(candidate => {
      const votes = countMap.get(candidate.id) ?? 0;
      return {
        id: candidate.id,
        name: candidate.name,
        listLabel: candidate.listLabel,
        party: candidate.party,
        ballotNumber: candidate.ballotNumber,
        colorHex: candidate.colorHex,
        isNoResponse: candidate.isNoResponse,
        votes,
        percentage: total ? votes / total * 100 : 0
      };
    });

  type HourRow = { hourLabel: string; candidateId: string; count: bigint };
  const hourlyRows = await prisma.$queryRaw<HourRow[]>(Prisma.sql`
    SELECT to_char(date_trunc('hour', "createdAt" AT TIME ZONE ${election.timezone}), 'YYYY-MM-DD HH24:00') AS "hourLabel",
           "candidateId" AS "candidateId",
           COUNT(*)::bigint AS "count"
    FROM "Vote"
    WHERE "electionId" = ${election.id}
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `);

  const byHour = new Map<string, Map<string, number>>();
  for (const row of hourlyRows) {
    if (!byHour.has(row.hourLabel)) byHour.set(row.hourLabel, new Map());
    byHour.get(row.hourLabel)!.set(row.candidateId, Number(row.count));
  }

  const running = new Map<string, number>();
  const hourly = [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourLabel, hourMap]) => {
      for (const candidate of candidates) {
        running.set(candidate.id, (running.get(candidate.id) ?? 0) + (hourMap.get(candidate.id) ?? 0));
      }
      return {
        hourLabel,
        total: [...running.values()].reduce((sum, value) => sum + value, 0),
        candidates: candidateResults.map(candidate => ({
          candidateId: candidate.id,
          votes: running.get(candidate.id) ?? 0
        }))
      };
    });

  return {
    election: {
      id: election.id,
      name: election.name,
      city: election.city,
      electionDate: election.electionDate,
      timezone: election.timezone,
      status: election.status,
      brandName: election.brandName,
      brandSubtitle: election.brandSubtitle,
      brandLogoData: election.brandLogoData,
      brandPrimaryColor: election.brandPrimaryColor,
      brandSecondaryColor: election.brandSecondaryColor,
      brandBackgroundColor: election.brandBackgroundColor,
      brandSurfaceColor: election.brandSurfaceColor,
      brandTextColor: election.brandTextColor,
      tvTickerText: election.tvTickerText,
      tvShowClock: election.tvShowClock,
      tvShowTotal: election.tvShowTotal,
      tvShowUpdatedAt: election.tvShowUpdatedAt
    },
    total,
    candidates: candidateResults,
    hourly,
    updatedAt: new Date().toISOString()
  };
}
