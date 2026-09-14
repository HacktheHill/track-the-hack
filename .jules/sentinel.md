## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Data Leakage on User Signup
**Vulnerability:** The `users.signUp` tRPC endpoint returned the newly created or existing user object directly from Prisma's `findFirst` or `create` methods. By default, Prisma queries return all scalar fields, including sensitive ones like `passwordHash`. In tRPC endpoints without explicit output schemas, this data is leaked to the client.
**Learning:** Prisma queries return all scalar fields by default, including sensitive ones. In tRPC endpoints without explicit output schemas, this data is leaked to the client.
**Prevention:** Always restrict returned fields using Prisma's `select` or explicit output schemas to prevent information disclosure (e.g., in signup/login flows).
