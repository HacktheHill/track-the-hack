## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2024-10-24 - [Password Hash Leakage in SignUp]
**Vulnerability:** The `signUp` tRPC endpoint in `src/server/api/routers/users.ts` returns the full Prisma `User` record, including the `passwordHash`. An attacker could attempt to sign up with an existing user's email and receive the existing user's password hash in the response.
**Learning:** Prisma's default behavior returns all scalar fields. Without explicit output schemas or `select` restrictions, tRPC endpoints will leak sensitive data like password hashes to the client.
**Prevention:** Always restrict returned fields using Prisma's `select` statement or use explicit Zod output schemas when querying or creating sensitive records like Users.
