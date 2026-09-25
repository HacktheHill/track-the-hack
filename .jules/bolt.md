## 2025-02-20 - Optimize count metrics using native DB aggregation
**Learning:** Fetching and holding raw aggregated results using `prisma.groupBy` in a Node.js array just to calculate the length (i.e. `groupBy({ by: ["id"] }).length`) is O(n) space and time with respect to the database size. This is a significant memory bottleneck.
**Action:** Replace `groupBy().length` array aggregations with a native database COUNT aggregation (e.g., `prisma.model.count({ where: ... })`) to push the computation to the DB, avoid transferring bulk rows to memory, and return an O(1) space integer.
