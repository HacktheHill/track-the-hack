## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2024-10-25 - IDOR in teams.create
**Vulnerability:** The `teams.create` tRPC endpoint was a `publicProcedure` and did not verify that the submitted `hackerId` belonged to the authenticated user. This allowed any user to create a team and assign arbitrary hackers to it (IDOR).
**Learning:** Always verify that input parameters related to resource ownership match the authenticated session details before performing mutations.
**Prevention:** Use `protectedProcedure` for mutations that associate data with a specific user, and fetch the related profile (e.g., hacker profile via `userId: ctx.session.user.id`) to confirm the ID matches the request payload.
