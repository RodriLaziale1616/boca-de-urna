import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireCsrf, requireRole } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { realtimeBus } from "../services/realtime";

const router = Router();
router.use(requireAuth, requireRole(UserRole.OPERATOR));

const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.user.id ?? req.ip ?? "unknown",
  message: { error: "Ritmo de registro demasiado alto. Esperá unos segundos." }
});

router.get("/election", asyncHandler(async (req, res) => {
  const user = req.auth!.user;
  if (!user.assignedElectionId) return res.status(409).json({ error: "Operador sin elección asignada" });

  const election = await prisma.election.findUnique({
    where: { id: user.assignedElectionId },
    include: {
      candidates: {
        where: { active: true },
        orderBy: [{ isNoResponse: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  const place = user.pollingPlaceId
    ? await prisma.pollingPlace.findUnique({ where: { id: user.pollingPlaceId } })
    : null;

  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  res.json({
    election: {
      id: election.id,
      name: election.name,
      city: election.city,
      electionDate: election.electionDate,
      status: election.status,
      requireConfirmation: election.requireConfirmation,
      resetDelaySeconds: election.resetDelaySeconds,
      candidates: election.candidates.map(c => ({
        id: c.id,
        name: c.name,
        listLabel: c.listLabel,
        party: c.party,
        ballotNumber: c.ballotNumber,
        colorHex: c.colorHex,
        isNoResponse: c.isNoResponse
      }))
    },
    operator: { id: user.id, name: user.name },
    pollingPlace: place ? { id: place.id, name: place.name, code: place.code } : null
  });
}));

router.post("/votes", requireCsrf, voteLimiter, asyncHandler(async (req, res) => {
  const body = z.object({
    candidateId: z.string().min(1).max(64),
    requestId: z.string().uuid(),
    capturedAt: z.coerce.date().optional()
  }).parse(req.body);

  const user = req.auth!.user;
  if (!user.assignedElectionId) return res.status(409).json({ error: "Operador sin elección asignada" });

  const existing = await prisma.vote.findUnique({ where: { requestId: body.requestId } });
  if (existing) {
    if (existing.operatorId !== user.id) return res.status(409).json({ error: "Identificador de registro no válido" });
    return res.status(200).json({ ok: true, duplicate: true });
  }

  const now = new Date();
  const capturedAt = body.capturedAt ?? now;
  if (capturedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return res.status(400).json({ error: "La hora del dispositivo está adelantada. Verificá fecha y hora." });
  }
  if (capturedAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "El registro pendiente es demasiado antiguo para sincronizarse automáticamente" });
  }

  const [election, candidate] = await Promise.all([
    prisma.election.findUnique({ where: { id: user.assignedElectionId } }),
    prisma.candidate.findUnique({ where: { id: body.candidateId } })
  ]);

  if (!election || election.status !== "ACTIVE") {
    return res.status(409).json({ error: "La encuesta no está activa" });
  }
  if (!candidate || !candidate.active || candidate.electionId !== election.id) {
    return res.status(400).json({ error: "Opción no válida" });
  }

  if (user.pollingPlaceId) {
    const place = await prisma.pollingPlace.findUnique({ where: { id: user.pollingPlaceId } });
    if (!place || !place.active || place.electionId !== election.id) {
      return res.status(409).json({ error: "Local de votación no válido" });
    }
  }

  const lastVote = await prisma.vote.findFirst({
    where: { operatorId: user.id, electionId: election.id },
    orderBy: { createdAt: "desc" },
    select: { capturedAt: true, createdAt: true }
  });
  const previousCapturedAt = lastVote?.capturedAt ?? lastVote?.createdAt ?? null;
  if (previousCapturedAt) {
    const deltaMs = capturedAt.getTime() - previousCapturedAt.getTime();
    if (deltaMs >= 0 && deltaMs < 700) {
      return res.status(429).json({ error: "Esperá un instante antes de registrar otra respuesta" });
    }
  }

  try {
    await prisma.vote.create({
      data: {
        electionId: election.id,
        candidateId: candidate.id,
        operatorId: user.id,
        pollingPlaceId: user.pollingPlaceId,
        requestId: body.requestId,
        capturedAt
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    throw error;
  }

  realtimeBus.publishVote(election.id);
  res.status(201).json({ ok: true });
}));

export default router;
