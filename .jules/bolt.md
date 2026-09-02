## 2024-11-20 - Group Independent Prisma Queries with Promise.all
**Learning:** Sequential Prisma database queries in tRPC endpoints create N+1 bottlenecks.
**Action:** Always group independent Prisma queries within a `Promise.all` block to prevent sequential execution bottlenecks.
