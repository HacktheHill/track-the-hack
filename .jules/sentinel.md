## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2026-09-08 - Information Disclosure in Prisma Queries
**Vulnerability:** The `users.signUp` tRPC mutation returned the raw result of `ctx.prisma.user.findFirst` and `ctx.prisma.user.create` without filtering the output. This caused sensitive data like `passwordHash` to be leaked to the client.
**Learning:** Prisma queries return all scalar fields by default. When exposing database results directly through tRPC endpoints without output schemas, sensitive fields can be inadvertently leaked to the frontend.
**Prevention:** Always use Prisma's `select` clause to explicitly specify which fields should be returned to the client, especially when returning user or authentication-related data, or use a Zod output schema to filter the response.
