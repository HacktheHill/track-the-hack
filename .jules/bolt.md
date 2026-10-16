## 2025-01-08 - Push unique array length calculations to Prisma distinct
**Learning:** In Prisma queries, fetching large numbers of rows into memory and deduplicating using JS `new Set(rows.map(row => row.id)).size` is inefficient and creates an O(N) array allocation overhead. However, Prisma's `count` doesn't support the `distinct` argument.
**Action:** Push deduplication to the database by using Prisma's `distinct: ['property']` option inside `findMany` combined with calling `.length` on the results to significantly improve performance.
