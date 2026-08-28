import { Router } from "express";
import bcrypt from "bcryptjs";
import { ElectionStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireCsrf, requireRole } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { realtimeBus } from "../services/realtime";

const router = Router();
router.use(requireAuth, requireRole(UserRole.ADMIN));

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const timezoneSchema = z.string().trim().min(3).max(60).refine(value => { try { new Intl.DateTimeFormat("es", { timeZone: value }); return true; } catch { return false; } }, "Zona horaria inválida");
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/);

async function audit(userId: string, action: string, entityType: string, entityId?: string, metadata?: unknown) {
  const safeMetadata = metadata === undefined ? undefined : JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
  await prisma.auditLog.create({ data: { userId, action, entityType, entityId, metadata: safeMetadata } });
}

router.get("/elections", asyncHandler(async (_req, res) => {
  const elections = await prisma.election.findMany({ orderBy: [{ electionDate: "desc" }, { createdAt: "desc" }] });
  res.json({ elections });
}));

router.post("/elections", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(3).max(120),
    city: z.string().trim().min(2).max(80),
    electionDate: z.coerce.date(),
    timezone: timezoneSchema.default("America/Asuncion")
  }).parse(req.body);

  const election = await prisma.$transaction(async tx => {
    const created = await tx.election.create({ data: body });
    await tx.candidate.create({
      data: {
        electionId: created.id,
        name: "No responde",
        listLabel: "Respuesta reservada",
        colorHex: "#64748B",
        isNoResponse: true,
        sortOrder: 9999
      }
    });
    return created;
  });

  await audit(req.auth!.user.id, "CREATE", "Election", election.id, { name: election.name });
  res.status(201).json({ election });
}));

router.patch("/elections/:id", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(3).max(120).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    electionDate: z.coerce.date().optional(),
    timezone: timezoneSchema.optional(),
    status: z.nativeEnum(ElectionStatus).optional(),
    requireConfirmation: z.boolean().optional(),
    resetDelaySeconds: z.coerce.number().int().min(1).max(10).optional()
  }).parse(req.body);

  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Elección no encontrada" });

  if (body.status === "DRAFT" && existing.status !== "DRAFT") {
    const voteCount = await prisma.vote.count({ where: { electionId: existing.id } });
    if (voteCount > 0) return res.status(409).json({ error: "La configuración de candidatos queda bloqueada una vez que existen respuestas" });
  }

  if (body.status === "ACTIVE") {
    await prisma.election.updateMany({
      where: { id: { not: existing.id }, status: "ACTIVE" },
      data: { status: "CLOSED" }
    });
  }

  const election = await prisma.election.update({ where: { id: existing.id }, data: body });
  await audit(req.auth!.user.id, "UPDATE", "Election", election.id, body as unknown as Prisma.InputJsonValue);
  res.json({ election });
}));

router.get("/candidates", asyncHandler(async (req, res) => {
  const electionId = z.string().min(1).parse(req.query.electionId);
  const candidates = await prisma.candidate.findMany({
    where: { electionId },
    orderBy: [{ isNoResponse: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });
  res.json({ candidates });
}));

router.post("/candidates", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    electionId: z.string().min(1),
    name: z.string().trim().min(2).max(100),
    listLabel: z.string().trim().max(80).nullable().optional(),
    party: z.string().trim().max(120).nullable().optional(),
    ballotNumber: z.string().trim().max(12).nullable().optional(),
    colorHex: hexColor,
    sortOrder: z.coerce.number().int().min(0).max(999).default(0)
  }).parse(req.body);

  const election = await prisma.election.findUnique({ where: { id: body.electionId } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });
  if (election.status !== "DRAFT") return res.status(409).json({ error: "Los candidatos solo se pueden configurar mientras la elección está en borrador" });

  const candidate = await prisma.candidate.create({ data: { ...body, isNoResponse: false } });
  await audit(req.auth!.user.id, "CREATE", "Candidate", candidate.id, { name: candidate.name });
  res.status(201).json({ candidate });
}));

router.patch("/candidates/:id", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    listLabel: z.string().trim().max(80).nullable().optional(),
    party: z.string().trim().max(120).nullable().optional(),
    ballotNumber: z.string().trim().max(12).nullable().optional(),
    colorHex: hexColor.optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    active: z.boolean().optional()
  }).parse(req.body);

  const current = await prisma.candidate.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Candidato no encontrado" });
  const election = await prisma.election.findUnique({ where: { id: current.electionId } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });
  if (election.status !== "DRAFT") return res.status(409).json({ error: "Los candidatos quedan bloqueados al activar la elección" });
  if (current.isNoResponse && body.active === false) return res.status(400).json({ error: "No responde debe permanecer disponible" });

  const candidate = await prisma.candidate.update({ where: { id: current.id }, data: body });
  await audit(req.auth!.user.id, "UPDATE", "Candidate", candidate.id, body as unknown as Prisma.InputJsonValue);
  res.json({ candidate });
}));

router.get("/places", asyncHandler(async (req, res) => {
  const electionId = z.string().min(1).parse(req.query.electionId);
  const places = await prisma.pollingPlace.findMany({ where: { electionId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  res.json({ places });
}));

router.post("/places", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    electionId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().max(30).nullable().optional()
  }).parse(req.body);

  const election = await prisma.election.findUnique({ where: { id: body.electionId } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });
  const place = await prisma.pollingPlace.create({ data: body });
  await audit(req.auth!.user.id, "CREATE", "PollingPlace", place.id, { name: place.name });
  res.status(201).json({ place });
}));

router.patch("/places/:id", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().max(30).nullable().optional(),
    active: z.boolean().optional()
  }).parse(req.body);

  const current = await prisma.pollingPlace.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Local no encontrado" });
  const place = await prisma.pollingPlace.update({ where: { id: current.id }, data: body });
  await audit(req.auth!.user.id, "UPDATE", "PollingPlace", place.id, body as unknown as Prisma.InputJsonValue);
  res.json({ place });
}));

router.get("/operators", asyncHandler(async (req, res) => {
  const electionId = req.query.electionId ? z.string().min(1).parse(req.query.electionId) : undefined;
  const operators = await prisma.user.findMany({
    where: { role: UserRole.OPERATOR, ...(electionId ? { assignedElectionId: electionId } : {}) },
    select: {
      id: true,
      name: true,
      username: true,
      active: true,
      assignedElectionId: true,
      pollingPlaceId: true,
      pollingPlace: { select: { id: true, name: true } },
      assignedElection: { select: { id: true, name: true } },
      createdAt: true
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
  res.json({ operators });
}));

router.post("/operators", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100),
    username: usernameSchema,
    password: z.string().min(8).max(200),
    assignedElectionId: z.string().min(1),
    pollingPlaceId: z.string().min(1).nullable().optional()
  }).parse(req.body);

  const election = await prisma.election.findUnique({ where: { id: body.assignedElectionId } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });
  if (body.pollingPlaceId) {
    const place = await prisma.pollingPlace.findUnique({ where: { id: body.pollingPlaceId } });
    if (!place || place.electionId !== election.id) return res.status(400).json({ error: "Local no válido" });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  try {
    const operator = await prisma.user.create({
      data: {
        name: body.name,
        username: body.username,
        passwordHash,
        role: UserRole.OPERATOR,
        assignedElectionId: body.assignedElectionId,
        pollingPlaceId: body.pollingPlaceId ?? null
      },
      select: { id: true, name: true, username: true, active: true, assignedElectionId: true, pollingPlaceId: true }
    });
    await audit(req.auth!.user.id, "CREATE", "Operator", operator.id, { username: operator.username });
    res.status(201).json({ operator });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "Ese usuario ya existe" });
    }
    throw error;
  }
}));

router.patch("/operators/:id", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
    assignedElectionId: z.string().min(1).nullable().optional(),
    pollingPlaceId: z.string().min(1).nullable().optional()
  }).parse(req.body);

  const current = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!current || current.role !== UserRole.OPERATOR) return res.status(404).json({ error: "Operador no encontrado" });

  const targetElectionId = body.assignedElectionId === undefined ? current.assignedElectionId : body.assignedElectionId;
  if (body.assignedElectionId) {
    const targetElection = await prisma.election.findUnique({ where: { id: body.assignedElectionId } });
    if (!targetElection) return res.status(400).json({ error: "Elección no válida" });
  }
  if (body.pollingPlaceId) {
    const targetPlace = await prisma.pollingPlace.findUnique({ where: { id: body.pollingPlaceId } });
    if (!targetPlace || !targetElectionId || targetPlace.electionId !== targetElectionId) {
      return res.status(400).json({ error: "El local no pertenece a la elección asignada" });
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.active !== undefined) data.active = body.active;
  if (body.password !== undefined) data.passwordHash = await bcrypt.hash(body.password, 12);
  if (body.assignedElectionId !== undefined) {
    data.assignedElection = body.assignedElectionId ? { connect: { id: body.assignedElectionId } } : { disconnect: true };
    if (body.pollingPlaceId === undefined && body.assignedElectionId !== current.assignedElectionId) data.pollingPlace = { disconnect: true };
  }
  if (body.pollingPlaceId !== undefined) data.pollingPlace = body.pollingPlaceId ? { connect: { id: body.pollingPlaceId } } : { disconnect: true };

  const operator = await prisma.user.update({
    where: { id: current.id },
    data,
    select: { id: true, name: true, username: true, active: true, assignedElectionId: true, pollingPlaceId: true }
  });
  if (body.password || body.active === false) await prisma.session.deleteMany({ where: { userId: current.id } });
  await audit(req.auth!.user.id, "UPDATE", "Operator", operator.id, { active: operator.active });
  res.json({ operator });
}));

router.get("/overview", asyncHandler(async (req, res) => {
  const electionId = req.query.electionId ? z.string().min(1).parse(req.query.electionId) : undefined;
  const pollingPlaceId = req.query.pollingPlaceId ? z.string().min(1).parse(req.query.pollingPlaceId) : undefined;

  const election = electionId
    ? await prisma.election.findUnique({ where: { id: electionId } })
    : await prisma.election.findFirst({ orderBy: [{ status: "asc" }, { electionDate: "desc" }] });

  if (!election) return res.json({ election: null, total: 0, candidates: [], hourly: [], operators: [] });

  const voteWhere: Prisma.VoteWhereInput = {
    electionId: election.id,
    ...(pollingPlaceId ? { pollingPlaceId } : {})
  };

  const [candidates, total, grouped, operatorGroups, operators] = await Promise.all([
    prisma.candidate.findMany({ where: { electionId: election.id }, orderBy: [{ isNoResponse: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.vote.count({ where: voteWhere }),
    prisma.vote.groupBy({ by: ["candidateId"], where: voteWhere, _count: { _all: true } }),
    prisma.vote.groupBy({ by: ["operatorId"], where: voteWhere, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.user.findMany({
      where: { role: UserRole.OPERATOR, assignedElectionId: election.id, ...(pollingPlaceId ? { pollingPlaceId } : {}) },
      select: { id: true, name: true, username: true, active: true, pollingPlace: { select: { name: true } } }
    })
  ]);

  const countMap = new Map(grouped.map(g => [g.candidateId, g._count._all]));
  const candidateResults = candidates.map(c => ({
    id: c.id,
    name: c.name,
    listLabel: c.listLabel,
    party: c.party,
    ballotNumber: c.ballotNumber,
    colorHex: c.colorHex,
    isNoResponse: c.isNoResponse,
    active: c.active,
    votes: countMap.get(c.id) ?? 0,
    percentage: total ? ((countMap.get(c.id) ?? 0) / total) * 100 : 0
  }));

  const operatorMap = new Map(operatorGroups.map(g => [g.operatorId, g]));
  const operatorStats = operators.map(o => {
    const g = operatorMap.get(o.id);
    const count = g?._count._all ?? 0;
    const lastVoteAt = g?._max.createdAt ?? null;
    return {
      id: o.id,
      name: o.name,
      username: o.username,
      active: o.active,
      pollingPlace: o.pollingPlace?.name ?? null,
      votes: count,
      percentageOfTotal: total ? count / total * 100 : 0,
      lastVoteAt,
      activity: !o.active ? "DISABLED" : !lastVoteAt ? "NO_ACTIVITY" : Date.now() - lastVoteAt.getTime() < 30 * 60 * 1000 ? "ACTIVE" : "LOW"
    };
  }).sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

  type HourRow = { hourLabel: string; candidateId: string; count: bigint };
  const hourlyRows = pollingPlaceId
    ? await prisma.$queryRaw<HourRow[]>(Prisma.sql`
        SELECT to_char(date_trunc('hour', "createdAt" AT TIME ZONE ${election.timezone}), 'YYYY-MM-DD HH24:00') AS "hourLabel",
               "candidateId" AS "candidateId",
               COUNT(*)::bigint AS "count"
        FROM "Vote"
        WHERE "electionId" = ${election.id} AND "pollingPlaceId" = ${pollingPlaceId}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `)
    : await prisma.$queryRaw<HourRow[]>(Prisma.sql`
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
  const hourly = [...byHour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hourLabel, hourMap]) => {
    for (const candidate of candidates) {
      running.set(candidate.id, (running.get(candidate.id) ?? 0) + (hourMap.get(candidate.id) ?? 0));
    }
    const cumulativeTotal = [...running.values()].reduce((a, b) => a + b, 0);
    return {
      hourLabel,
      total: cumulativeTotal,
      candidates: candidates.map(c => ({ candidateId: c.id, votes: running.get(c.id) ?? 0 }))
    };
  });

  res.json({ election, total, candidates: candidateResults, hourly, operators: operatorStats });
}));

router.get("/stream", asyncHandler(async (req, res) => {
  const electionId = z.string().min(1).parse(req.query.electionId);
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const eventName = `vote:${election.id}`;
  const onVote = () => res.write(`event: vote\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
  realtimeBus.on(eventName, onVote);
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 20000);
  req.on("close", () => {
    clearInterval(heartbeat);
    realtimeBus.off(eventName, onVote);
  });
}));

router.get("/audit", asyncHandler(async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, username: true } } }
  });
  res.json({ logs });
}));

export default router;
