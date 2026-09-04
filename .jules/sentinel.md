## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2024-05-24 - [IDOR in TRPC Mutation]
**Vulnerability:** A user could pass an arbitrary `id` to the `confirm` tRPC mutation in `src/server/api/routers/hackers.ts` and modify attendance status for other users, causing an IDOR (Insecure Direct Object Reference) vulnerability.
**Learning:** tRPC endpoints modifying database records must explicitly verify that the entity ID being modified matches the currently authenticated user's ID (`ctx.session.user.id` or its mapped foreign key) unless the user has administrative privileges.
**Prevention:** Always check user role permissions or resource ownership against `ctx.session.user` before applying database updates on mutation inputs containing identifiers.
