## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-25 - Data Leak in `users.signUp`
**Vulnerability:** The `users.signUp` tRPC mutation returned the entire user object directly from Prisma, including the `passwordHash` field, leaking sensitive password hashes to the client. Additionally, `findFirst` was used to check for an existing user, which returned the entire user object including the `passwordHash`, although it wasn't strictly necessary.
**Learning:** Prisma queries return all fields by default, including sensitive ones. In tRPC endpoints without explicit output schemas, this data is leaked to the client.
**Prevention:** Always restrict returned fields using Prisma's `select` or explicitly construct the returned object to omit sensitive fields.
