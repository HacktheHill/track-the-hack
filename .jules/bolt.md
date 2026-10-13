## 2023-10-13 - [Push Deduplication to Database]
**Learning:** Avoid fetching arrays from the database only to measure unique counts in JavaScript (e.g., `new Set(rows.map(row => row.id)).size`). This is inefficient, O(N^2) computationally, and transfers too much data over the network.
**Action:** Push deduplication to the database by using Prisma's `distinct: ['property']` option combined with `.length` to significantly improve performance.
