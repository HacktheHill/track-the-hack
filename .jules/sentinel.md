## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2024-05-15 - Prisma Sensitive Field Leakage
**Vulnerability:** The `signUp` endpoint leaked the `passwordHash` of users because the default behavior of Prisma's `findFirst` and `create` returns all scalar fields.
**Learning:** In tRPC endpoints, relying on Prisma's default select behavior can expose sensitive data to clients if the endpoint returns the database model directly.
**Prevention:** Always use the `select` property in Prisma queries to explicitly define which fields are safe to return to the client, especially for endpoints that return user records.
