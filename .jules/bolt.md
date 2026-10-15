
## 2024-05-14 - Prisma Distinct Deduplication
**Learning:** Prisma's `.count()` API in this version lacks support for the `distinct` argument, which often leads to an anti-pattern where developers fetch full arrays to deduplicate via JS (`new Set(rows).size`).
**Action:** Push deduplication to the database level to save memory and avoid O(N) processing by using `.findMany({ distinct: ['field'], select: { field: true } })` followed by `.length` on the result.
