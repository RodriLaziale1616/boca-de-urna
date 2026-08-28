import type { User, Session } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: User;
        session: Session;
      };
    }
  }
}

export {};
