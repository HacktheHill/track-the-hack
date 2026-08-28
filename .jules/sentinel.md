## 2024-05-18 - Missing Authorization on TRPC Endpoint
**Vulnerability:** IDOR in `downloadResume` endpoint allowed anyone to fetch anyone's resume presigned URL.
**Learning:** `protectedProcedure` only enforces authentication (logged-in), it does *not* enforce authorization (access controls).
**Prevention:** Always use `hasRoles` utility to check permissions for roles (e.g. `ORGANIZER`) or explicitly check `resource.userId === ctx.session.user.id` for self-serve actions in protected tRPC procedures.
