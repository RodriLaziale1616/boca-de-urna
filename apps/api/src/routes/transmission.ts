import { randomBytes } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCsrf, requireRole } from "../auth";
import { prisma } from "../db";
import { getTvDataByElection } from "../services/tvData";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth, requireRole(UserRole.ADMIN));

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const logoData = z.string()
  .max(250_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .nullable();

async function audit(userId: string, action: string, electionId: string, metadata?: unknown) {
  const safeMetadata = metadata === undefined ? undefined : JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
  await prisma.auditLog.create({
    data: { userId, action, entityType: "ElectionTransmission", entityId: electionId, metadata: safeMetadata }
  });
}

router.get("/:id", asyncHandler(async (req, res) => {
  const election = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!election) return res.status(404).json({ error: "Elección no encontrada" });

  const preview = await getTvDataByElection(election.id);
  res.json({
    config: {
      brandName: election.brandName,
      brandSubtitle: election.brandSubtitle,
      brandLogoData: election.brandLogoData,
      brandPrimaryColor: election.brandPrimaryColor,
      brandSecondaryColor: election.brandSecondaryColor,
      brandBackgroundColor: election.brandBackgroundColor,
      brandSurfaceColor: election.brandSurfaceColor,
      brandTextColor: election.brandTextColor,
      tvTickerText: election.tvTickerText,
      tvPublicEnabled: election.tvPublicEnabled,
      tvAccessToken: election.tvAccessToken,
      tvShowClock: election.tvShowClock,
      tvShowTotal: election.tvShowTotal,
      tvShowUpdatedAt: election.tvShowUpdatedAt
    },
    preview
  });
}));

router.patch("/:id", requireCsrf, asyncHandler(async (req, res) => {
  const body = z.object({
    brandName: z.string().trim().max(80).nullable().optional(),
    brandSubtitle: z.string().trim().max(120).nullable().optional(),
    brandLogoData: logoData.optional(),
    brandPrimaryColor: hexColor.optional(),
    brandSecondaryColor: hexColor.optional(),
    brandBackgroundColor: hexColor.optional(),
    brandSurfaceColor: hexColor.optional(),
    brandTextColor: hexColor.optional(),
    tvTickerText: z.string().trim().max(180).nullable().optional(),
    tvShowClock: z.boolean().optional(),
    tvShowTotal: z.boolean().optional(),
    tvShowUpdatedAt: z.boolean().optional()
  }).parse(req.body);

  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Elección no encontrada" });

  const election = await prisma.election.update({ where: { id: existing.id }, data: body });
  await audit(req.auth!.user.id, "UPDATE_TRANSMISSION_BRANDING", election.id, {
    changed: Object.keys(body).filter(key => key !== "brandLogoData")
  });
  res.json({ election });
}));

router.post("/:id/publish", requireCsrf, asyncHandler(async (req, res) => {
  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Elección no encontrada" });

  const token = existing.tvAccessToken ?? randomBytes(32).toString("base64url");
  const election = await prisma.election.update({
    where: { id: existing.id },
    data: { tvPublicEnabled: true, tvAccessToken: token }
  });
  await audit(req.auth!.user.id, "PUBLISH_TV", election.id);
  res.json({ enabled: true, token });
}));

router.post("/:id/unpublish", requireCsrf, asyncHandler(async (req, res) => {
  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Elección no encontrada" });

  await prisma.election.update({ where: { id: existing.id }, data: { tvPublicEnabled: false } });
  await audit(req.auth!.user.id, "UNPUBLISH_TV", existing.id);
  res.json({ enabled: false });
}));

router.post("/:id/rotate-link", requireCsrf, asyncHandler(async (req, res) => {
  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Elección no encontrada" });

  const token = randomBytes(32).toString("base64url");
  await prisma.election.update({
    where: { id: existing.id },
    data: { tvPublicEnabled: true, tvAccessToken: token }
  });
  await audit(req.auth!.user.id, "ROTATE_TV_LINK", existing.id);
  res.json({ enabled: true, token });
}));

export default router;
