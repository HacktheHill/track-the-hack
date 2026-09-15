## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Default Prisma Queries Leak Data
**Vulnerability:** The `signUp` endpoint in `users.ts` returned the raw user object from `prisma.user.findFirst` and `prisma.user.create`. Prisma returns all fields by default (including `passwordHash`), leaking this sensitive information to the client upon sign-up or if an existing email was checked.
**Learning:** Returning Prisma objects directly from tRPC endpoints without explicit output schemas or `.select` clauses inadvertently exposes all database columns for that model, leading to insecure direct object references (or mass assignment vulnerabilities in reverse).
**Prevention:** Always use Prisma's `select` statement to constrain the returned fields to only what is necessary (e.g., `id`, `name`, `email`), or define explicit Zod `.output()` schemas on tRPC routes to strip out sensitive properties before they hit the wire.
