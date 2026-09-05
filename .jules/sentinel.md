## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.
## 2026-09-05 - [Fix IDOR in Hacker Endpoints]
**Vulnerability:** IDOR (Insecure Direct Object Reference) found in `confirm` and `downloadResume` endpoints in `src/server/api/routers/hackers.ts`.
**Learning:** The endpoints used `protectedProcedure` which ensures the user is logged in, but failed to verify resource ownership (i.e., whether the requested hacker object actually belongs to the authenticated user). This allowed any logged-in user to pass another user's ID and access/modify their data.
**Prevention:** When fetching user-specific resources in tRPC, explicitly verify that the `userId` on the retrieved object matches `ctx.session.user.id`, or check if the user possesses an administrative role (e.g., `RoleName.ORGANIZER`). Always use `TRPCError` to properly fail unauthorized requests.
