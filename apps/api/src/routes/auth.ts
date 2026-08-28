import { Router } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { createSession, destroySession, requireAuth, requireCsrf } from "../auth";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Esperá unos minutos." }
});

router.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().trim().min(2).max(64),
    password: z.string().min(1).max(200)
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { username: body.username.toLowerCase() } });
  const ok = user && user.active && await bcrypt.compare(body.password, user.passwordHash);

  if (!ok || !user) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  const csrfToken = await createSession(user.id, res);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      assignedElectionId: user.assignedElectionId,
      pollingPlaceId: user.pollingPlaceId
    },
    csrfToken
  });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = req.auth!.user;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      assignedElectionId: user.assignedElectionId,
      pollingPlaceId: user.pollingPlaceId
    },
    csrfToken: req.auth!.session.csrfToken
  });
}));

router.post("/logout", requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  await destroySession(req, res);
  res.status(204).end();
}));

export default router;
