## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-05-24 - [Fix IDOR in Resume Download Endpoint]
**Vulnerability:** Insecure Direct Object Reference (IDOR) allowed any authenticated user to download any hacker's resume if they knew the hacker's ID, as there was no check on resource ownership or user role.
**Learning:** `protectedProcedure` only ensures a user is logged in, but doesn't inherently verify if they have authorization to access the specific requested data/object.
**Prevention:** Always verify resource ownership (e.g. `user.Hacker?.id === hacker.id`) or check for proper admin/organizer roles (using `hasRoles`) before returning sensitive data in tRPC protected procedures.
