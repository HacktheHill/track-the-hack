## 2025-02-23 - [Optimization of metrics query with parallelization]
**Learning:** Sequential Prisma queries in tRPC routers can cause a significant bottleneck. Additionally, some derived metrics were redundant queries that could be constructed from other queries' results.
**Action:** Use Promise.all to parallelize independent database queries and reuse results for derived data calculations to limit the overall amount of queries executed.
