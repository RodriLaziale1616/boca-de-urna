import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { authMiddleware, ensureBootstrapAdmin } from "./auth";
import authRoutes from "./routes/auth";
import operatorRoutes from "./routes/operator";
import adminRoutes from "./routes/admin";
import { env, isProduction } from "./env";
import { prisma } from "./db";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-origin" },
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  } : false
}));
app.use(compression());
app.use(express.json({ limit: "60kb" }));
app.use(cookieParser());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));
app.use(authMiddleware);
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/admin", adminRoutes);

if (isProduction) {
  const webDist = path.resolve(__dirname, "../../web/dist");
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

async function start() {
  await ensureBootstrapAdmin();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  app.listen(env.PORT, () => console.log(`Boca de Urna API escuchando en :${env.PORT}`));
}

start().catch(async error => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
