## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2025-02-27 - [Information Exposure in Prisma + tRPC endpoints]
**Vulnerability:** Prisma queries in tRPC endpoints (`signUp` in this case) were returning entire user records, which were subsequently returned directly to the client, exposing the `passwordHash` field.
**Learning:** By default, Prisma queries (e.g. `findFirst`, `create`) retrieve all scalar fields unless specified otherwise. This can easily leak sensitive backend-only fields if endpoints directly return the query object to the client.
**Prevention:** Always explicitly define a `select` clause restricting returned fields for endpoints handling sensitive data, or avoid returning raw database query results directly to the client.
