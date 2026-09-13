## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2026-09-13 - Fix passwordHash data leak in signUp endpoint
**Vulnerability:** The `signUp` tRPC endpoint leaked the `passwordHash` (and other sensitive fields) in the return value of both `findFirst` and `create` Prisma queries, because Prisma by default returns all fields and the tRPC endpoint had no output validation schema.
**Learning:** Prisma queries (`findFirst`, `create`) return all fields unless explicitly constrained with `select`. Unrestricted returns in tRPC endpoints without output schemas can inadvertently leak sensitive information like password hashes to the client.
**Prevention:** Always restrict returned fields using Prisma's `select` to prevent data leaks, or implement explicit Zod output validation schemas for all tRPC endpoints handling sensitive data.
