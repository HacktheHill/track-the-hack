## 2024-10-04 - Optimize Set Mapping Query to Database Distinct
**Learning:** Found a recurring pattern where arrays from the database were being loaded into memory, `.map`ed over to extract specific properties, and passed into `new Set(...)` just to measure `.size`.
**Action:** Replace `rows => new Set(rows.map(row => row.property)).size` with Prisma's `distinct: ["property"]` option combined with `.length`. This pushes the deduplication down to the database level and eliminates O(N) array transformations (map -> set -> size) in JS, significantly improving CPU efficiency on large datasets.
