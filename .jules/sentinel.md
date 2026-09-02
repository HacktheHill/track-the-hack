## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Missing Authorization in `auditLog` router
**Vulnerability:** The `logRouter` TRPC procedures (`new` and `all`) in `auditLog.ts` were only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to fetch and create audit logs, a critical IDOR/authorization vulnerability.
**Learning:** In TRPC routers relying on `protectedProcedure`, explicit authorization checks must be performed using `hasRoles` for sensitive endpoints. Furthermore, `new PrismaClient()` was incorrectly instantiated locally in the router instead of using `ctx.prisma` from context.
**Prevention:** Verify if a `protectedProcedure` requires specific administrative roles and use `hasRoles` combined with a `findUnique` database call before processing the request. Avoid creating standalone Prisma Clients, and use `ctx.prisma`.
