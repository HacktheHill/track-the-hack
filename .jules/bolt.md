
## 2023-10-14 - Prisma Database Deduping
**Learning:** Avoid fetching arrays from the database only to measure unique counts in JavaScript (e.g., `new Set(rows.map(row => row.id)).size`). Prisma's `.count()` API does not support the `distinct` argument in this project's version, which causes a TypeScript compilation error (`'distinct' does not exist in type`).
**Action:** To compute a distinct count at the database level, push deduplication to the database by using Prisma's `.findMany({ distinct: ['field'], select: { field: true } })` followed by calling `.length` on the results to significantly improve performance.
