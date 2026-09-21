## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-24 - Information Disclosure in Events tRPC Endpoints
**Vulnerability:** The public tRPC endpoints `events.get`, `events.all`, and `events.future` did not filter out `hidden` events, resulting in an information disclosure vulnerability where any public user could fetch details of hidden events meant only for organizers.
**Learning:** Even if the frontend UI filters out sensitive or hidden data, the backend tRPC endpoints (`publicProcedure`) must strictly filter the returned records from the database directly, as clients can easily query the API bypassing UI filters.
**Prevention:** Always enforce data visibility constraints (like `hidden: false`) at the Prisma query level in public procedures. Use the user's session role (e.g., `ORGANIZER` or `ADMIN`) to conditionally override these filters when authorized access is required.
