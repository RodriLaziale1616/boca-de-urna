import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { env, isProduction } from "./env";

export const SESSION_COOKIE = "bdurna_sid";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const makeToken = () => crypto.randomBytes(32).toString("base64url");

export async function createSession(userId: string, res: Response) {
  const rawToken = makeToken();
  const csrfToken = makeToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(rawToken), csrfToken, expiresAt }
  });

  res.cookie(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    expires: expiresAt
  });

  return csrfToken;
}

export async function destroySession(req: Request, res: Response) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProduction, sameSite: "strict", path: "/" });
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true }
    });

    if (!session || session.expiresAt <= new Date() || !session.user.active) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return next();
    }

    req.auth = { user: session.user, session };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "No autenticado" });
  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "No autenticado" });
    if (req.auth.user.role !== role) return res.status(403).json({ error: "Sin permisos" });
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "No autenticado" });
  const token = req.header("x-csrf-token");
  if (!token || token.length > 128 || token !== req.auth.session.csrfToken) {
    return res.status(403).json({ error: "Solicitud no válida" });
  }
  next();
}

export async function ensureBootstrapAdmin() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  if (!env.ADMIN_NAME || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    console.warn("No hay usuarios y faltan ADMIN_NAME / ADMIN_USERNAME / ADMIN_PASSWORD.");
    return;
  }
  if (env.ADMIN_PASSWORD.length < 10) {
    console.warn("ADMIN_PASSWORD debe tener al menos 10 caracteres. No se creó el administrador.");
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      name: env.ADMIN_NAME,
      username: env.ADMIN_USERNAME.trim().toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN
    }
  });
  console.log(`Administrador inicial creado: ${env.ADMIN_USERNAME}`);
}
