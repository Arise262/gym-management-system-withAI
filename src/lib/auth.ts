import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const BCRYPT_ROUNDS = 12;

/**
 * A real hash of a value nobody can supply, computed once at module load.
 * Compared against when the email doesn't exist so that an unknown account
 * costs the same wall-clock time as a wrong password — otherwise the response
 * time alone tells an attacker which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync("user-does-not-exist", BCRYPT_ROUNDS);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Credentials auth requires JWT sessions — database sessions are not supported
  // for this provider, which is also why no Prisma adapter is wired up.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
          include: { member: { select: { id: true, name: true } } },
        });

        const passwordOk = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ?? DUMMY_HASH
        );

        if (!user || !user.isActive || !passwordOk) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.member?.name ?? null,
          role: user.role,
          memberId: user.member?.id ?? null,
        };
      },
    }),
  ],
});
