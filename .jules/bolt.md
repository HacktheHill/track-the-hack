## 2024-05-18 - DB Query Optimization Anti-Pattern
**Learning:** Found two anti-patterns in Prisma usage in metrics calculation: fetching full rows into memory to do sum aggregations via `reduce()` instead of using `_sum`, and running redundant `.count()` queries for values that were already fetched into variables just lines prior.
**Action:** When working with metrics/dashboards, always prefer database-level aggregation over memory-level aggregation, and reuse already-fetched variables to avoid redundant queries.
