import { Router } from "express";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireCsrf, requireRole } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth, requireRole(UserRole.ADMIN));

const resetBodySchema = z.object({
  confirmation: z.literal("RESETAR PRUEBAS"),
  password: z.string().min(1).max(200)
});

const officialBodySchema = z.object({
  confirmation: z.literal("INICIAR OFICIAL"),
  password: z.string().min(1).max(200)
});

async function verifyAdminPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== UserRole.ADMIN || !user.active) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function getOfficialLock(electionId: string) {
  return prisma.auditLog.findFirst({
    where: {
      action: "START_OFFICIAL",
      entityType: "Election",
      entityId: electionId
    },
    orderBy: { createdAt: "asc" }
  });
}

router.get("/elections/:id/status", asyncHandler(async (req, res) => {
  const election = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  const lock = await getOfficialLock(election.id);
  const [votes, operators] = await Promise.all([
    prisma.vote.count({ where: { electionId: election.id } }),
    prisma.user.count({ where: { role: UserRole.OPERATOR, assignedElectionId: election.id } })
  ]);

  res.json({
    official: Boolean(lock),
    officialStartedAt: lock?.createdAt ?? null,
    votes,
    operators
  });
}));

router.post("/elections/:id/reset-test-data", requireCsrf, asyncHandler(async (req, res) => {
  const body = resetBodySchema.parse(req.body);
  const adminId = req.auth!.user.id;

  if (!(await verifyAdminPassword(adminId, body.password))) {
    return res.status(401).json({ error: "Contraseña de administrador incorrecta" });
  }

  const election = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  const lock = await getOfficialLock(election.id);
  if (lock) {
    return res.status(409).json({ error: "Esta elección ya fue iniciada como operación oficial. El reset quedó bloqueado permanentemente." });
  }

  const [voteCount, operatorCount, candidateCount, placeCount] = await Promise.all([
    prisma.vote.count({ where: { electionId: election.id } }),
    prisma.user.count({ where: { role: UserRole.OPERATOR, assignedElectionId: election.id } }),
    prisma.candidate.count({ where: { electionId: election.id } }),
    prisma.pollingPlace.count({ where: { electionId: election.id } })
  ]);

  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.allow_test_reset', 'on', true)`;
    await tx.vote.deleteMany({ where: { electionId: election.id } });
    await tx.user.deleteMany({ where: { role: UserRole.OPERATOR, assignedElectionId: election.id } });
    await tx.election.delete({ where: { id: election.id } });
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "RESET_TEST_DATA",
      entityType: "Election",
      entityId: election.id,
      metadata: {
        electionName: election.name,
        votesRemoved: voteCount,
        operatorsRemoved: operatorCount,
        candidatesRemoved: candidateCount,
        pollingPlacesRemoved: placeCount
      }
    }
  });

  res.json({
    ok: true,
    removed: {
      votes: voteCount,
      operators: operatorCount,
      candidates: candidateCount,
      pollingPlaces: placeCount,
      election: 1
    }
  });
}));

router.post("/elections/:id/start-official", requireCsrf, asyncHandler(async (req, res) => {
  const body = officialBodySchema.parse(req.body);
  const adminId = req.auth!.user.id;

  if (!(await verifyAdminPassword(adminId, body.password))) {
    return res.status(401).json({ error: "Contraseña de administrador incorrecta" });
  }

  const election = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  const existingLock = await getOfficialLock(election.id);
  if (existingLock) {
    return res.status(409).json({ error: "La operación oficial ya fue iniciada para esta elección" });
  }

  const [candidateCount, operatorCount] = await Promise.all([
    prisma.candidate.count({ where: { electionId: election.id, active: true, isNoResponse: false } }),
    prisma.user.count({ where: { role: UserRole.OPERATOR, assignedElectionId: election.id, active: true } })
  ]);

  if (candidateCount < 1) return res.status(409).json({ error: "Agregá al menos un candidato antes de iniciar la operación oficial" });
  if (operatorCount < 1) return res.status(409).json({ error: "Creá al menos un operador activo antes de iniciar la operación oficial" });

  const updated = await prisma.$transaction(async tx => {
    await tx.election.updateMany({
      where: { id: { not: election.id }, status: "ACTIVE" },
      data: { status: "CLOSED" }
    });

    const nextElection = await tx.election.update({
      where: { id: election.id },
      data: { status: "ACTIVE" }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "START_OFFICIAL",
        entityType: "Election",
        entityId: election.id,
        metadata: {
          electionName: election.name,
          activeCandidates: candidateCount,
          activeOperators: operatorCount
        }
      }
    });

    return nextElection;
  });

  res.json({ election: updated, official: true });
}));

export default router;
