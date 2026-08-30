## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-25 - Missing Authorization in `auditLog` router
**Vulnerability:** The `auditLog` tRPC router (`new` and `all` endpoints) were only protected by authentication (`protectedProcedure`) without explicit role checks. This allowed any authenticated user to create or read sensitive audit logs. Furthermore, the router instantiated its own `PrismaClient` rather than using `ctx.prisma`.
**Learning:** `protectedProcedure` only guarantees authentication, not authorization. Also, directly instantiating `PrismaClient` inside a router causes connection pooling issues and fails to utilize shared context.
**Prevention:** Always use `hasRoles` for authorization checks in sensitive endpoints, and rely on `ctx.prisma` for database interactions instead of instantiating new Prisma clients.
