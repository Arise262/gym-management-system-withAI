import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** null for ADMIN / TRAINER accounts that have no Member profile. */
      memberId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    memberId?: string | null;
  }
}

// `next-auth/jwt` only re-exports @auth/core/jwt, and declaration merging does
// not follow re-exports — the augmentation has to target the defining module.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    memberId: string | null;
  }
}

export {};
