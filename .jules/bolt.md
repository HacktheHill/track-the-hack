## 2024-05-24 - [Optimize independent database queries]
**Learning:** Sequential execution of multiple independent Prisma queries in TRPC resolvers (`await` one after another) causes massive bottlenecks.
**Action:** Always group independent Prisma queries within a `Promise.all` block to prevent sequential execution bottlenecks. Also, avoid redundantly fetching counts that have already been queried by re-using the existing query results.
