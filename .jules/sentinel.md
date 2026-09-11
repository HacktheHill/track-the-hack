## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Information Disclosure in Prisma returned User Object
**Vulnerability:** The `users.signUp` tRPC endpoint returned the raw user object from `prisma.user.findFirst()` and `prisma.user.create()`, leading to sensitive data (`passwordHash`) being returned to the client upon sign-up or sign-in conflict.
**Learning:** Prisma queries return all fields of a model by default unless explicitly omitted, even if they are sensitive fields like `passwordHash`. When tRPC endpoints do not have explicit output schemas defined and return these results, this data leaks directly to the client.
**Prevention:** Always use Prisma's `select` option in `findFirst`, `findUnique`, `findMany` and `create` methods to explicitly choose which non-sensitive fields to expose to the client, especially when endpoints don't have output validation schemas enforcing return data structure.
