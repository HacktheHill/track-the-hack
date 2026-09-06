## 2025-02-27 - [Authorization Bypass on Team Creation]
**Vulnerability:** The `teams.create` endpoint uses `publicProcedure` and does not verify if the `hackerId` provided in the input matches the authenticated user, nor does it check if the user is authenticated at all. This allows any user to create a team and force another hacker to join it without authorization.
**Learning:** Public procedures should not be used for mutations modifying user-specific data. Authorization checks must be explicit and enforced using `protectedProcedure` with user identity matching (e.g. `ctx.session.user.id`).
**Prevention:** Always use `protectedProcedure` for endpoints modifying user state and verify that the requested modifications are for the authenticated user, or the user is an admin/organizer.
