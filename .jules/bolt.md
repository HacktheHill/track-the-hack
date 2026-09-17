
## 2024-05-18 - Avoid redundant database authentication queries for NextAuth Roles
**Learning:** The NextAuth session (`ctx.session.user`) already populates `roles` (as an array of strings, `RoleName[]`) and `hackerId`. In many tRPC endpoints, there are `ctx.prisma.user.findUnique` queries to lookup the user specifically to check their roles or verify hacker status. These database queries are completely redundant and cause a significant performance bottleneck (N+1-like).
**Action:** Use `hasRoles(ctx.session.user as Parameters<typeof hasRoles>[0], [...])` directly instead of doing `prisma.user.findUnique`. The `hasRoles` utility has been updated to accept both string role names (from session) and object role names (from DB `findUnique` select) gracefully.
