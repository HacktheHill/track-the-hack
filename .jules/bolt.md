## 2024-10-22 - Optimizing Distinct Counts in Prisma
**Learning:** Prisma's `.count()` API does not support the `distinct` argument in this project's version, which prevents us from doing `prisma.model.count({ distinct: ['field'] })`. We were working around this by fetching all rows to Node.js and deduplicating them with a `Set`.
**Action:** To compute a distinct count at the database level and avoid O(N) memory/network usage, use `.findMany({ distinct: ['field'], select: { field: true } })` followed by calling `.length` on the results. This pushes the deduplication to the database engine.
