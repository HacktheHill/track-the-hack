## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2025-02-27 - IDOR in Teams Creation
**Vulnerability:** The `teams.create` tRPC endpoint lacked IDOR checks, enabling any user to create a team for any other `hackerId` provided they knew or guessed the `hackerId` which was insecurely sourced.
**Learning:** For endpoints acting on behalf of a specific user, ensure that the authenticated user matches the targeted resource owner. We also spotted `PrismaClient` initialization at the router level which breaks connection pooling; `ctx.prisma` should be preferred.
**Prevention:** Always use `ctx.prisma` within the TRPC context and explicitly verify ownership (e.g. `hacker.userId === ctx.session.user.id`) for sensitive actions. Use `protectedProcedure` where authentication is assumed.
