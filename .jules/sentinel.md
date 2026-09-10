## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-05-24 - [CRITICAL] Prevent Information Disclosure via Prisma Default Selection
**Vulnerability:** Information Disclosure (leaking `passwordHash` in tRPC responses). The `signUp` procedure in `src/server/api/routers/users.ts` returned the entire user object directly from Prisma without any filtering.
**Learning:** Prisma queries like `findFirst` and `create` return all scalar fields of a model by default. When the result is directly returned from a tRPC procedure without explicitly defining an output schema or restricting the database query, sensitive data (e.g., `passwordHash`, internal IDs) can be leaked to clients.
**Prevention:** Always restrict the fields returned from Prisma by explicitly using the `select` clause in the query, especially for models containing sensitive information like `User`. Alternatively, define a strict `zod` object schema in `.output()` for the tRPC procedure to strip unlisted properties.
