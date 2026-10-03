 import { prisma } from "../db";
import { getCutRangeRows } from "./cutRanges";

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

  const hourlyRows = await getCutRangeRows(election.id, election.timezone);

  const byHour = new Map<string, Map<string, number>>();
  for (const row of hourlyRows) {
    if (!byHour.has(row.hourLabel)) byHour.set(row.hourLabel, new Map());
    byHour.get(row.hourLabel)!.set(row.candidateId, Number(row.count));
  }

  const hourly = [...byHour.entries()].map(([hourLabel, hourMap]) => ({
    hourLabel,
    total: [...hourMap.values()].reduce((sum, value) => sum + value, 0),
    candidates: candidateResults.map(candidate => ({
      candidateId: candidate.id,
      votes: hourMap.get(candidate.id) ?? 0
    }))
  }));

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
