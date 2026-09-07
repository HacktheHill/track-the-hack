## 2024-10-24 - Missing Authorization in `users.search`
**Vulnerability:** The `users.search` tRPC endpoint was only protected by authentication (`protectedProcedure`) without an explicit role check. This allowed any authenticated user to retrieve details (names, emails) of other users.
**Learning:** In this tRPC setup, `protectedProcedure` only guarantees authentication. It does not enforce role-based access control (authorization) out of the box unless explicitly checked within the procedure.
**Prevention:** Always verify if a `protectedProcedure` requires specific roles (like `ADMIN` or `ORGANIZER`) and use the `hasRoles` utility combined with `ctx.prisma.user.findUnique` to enforce these constraints. Additionally, ensure correct error propagation using `TRPCError`.

## 2024-10-25 - Information Disclosure in `users.signUp`
**Vulnerability:** The `users.signUp` tRPC endpoint leaked the existing user's password hash and entire database record to the client when attempting to sign up with an email that was already registered.
**Learning:** Prisma queries like `findFirst` return all scalar fields by default, including sensitive ones like `passwordHash`. In endpoints that don't enforce a strict output Zod schema, returning the direct Prisma result can lead to critical information disclosure.
**Prevention:** Never return the raw user object in cases where a duplicate is found (e.g., in a registration flow). Instead, throw a standard `TRPCError({ code: "CONFLICT", message: "User already exists" })` to safely fail the request without leaking sensitive information.
