## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Prisma Data Leak in tRPC Endpoints
**Vulnerability:** Prisma queries (`findFirst`, `create`, `findMany`, etc.) return all scalar fields by default, including sensitive ones like `passwordHash`. In the `users.signUp` tRPC endpoint, returning the unconstrained result of `ctx.prisma.user.findFirst` and `ctx.prisma.user.create` caused `passwordHash` to be sent to the client.
**Learning:** Prisma does not natively hide sensitive fields in responses unless explicitly omitted or unless only non-sensitive fields are explicitly requested using the `select` property.
**Prevention:** Always restrict returned fields using Prisma's `select` object when sending database results directly to clients via tRPC endpoints. Avoid returning raw Prisma results unless output schemas are strictly enforced.
