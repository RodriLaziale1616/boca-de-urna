import { Router } from "express";
import { prisma } from "../db";
import { realtimeBus } from "../services/realtime";
import { getTvDataByElection } from "../services/tvData";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

async function resolveElection(token: string) {
  return prisma.election.findFirst({
    where: { tvAccessToken: token, tvPublicEnabled: true },
    select: { id: true }
  });
}

router.get("/:token", asyncHandler(async (req, res) => {
  const election = await resolveElection(req.params.token);
  if (!election) return res.status(404).json({ error: "Transmisión no disponible" });

  const data = await getTvDataByElection(election.id);
  if (!data) return res.status(404).json({ error: "Transmisión no disponible" });
  res.json(data);
}));

router.get("/:token/stream", asyncHandler(async (req, res) => {
  const election = await resolveElection(req.params.token);
  if (!election) return res.status(404).json({ error: "Transmisión no disponible" });

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

export default router;
