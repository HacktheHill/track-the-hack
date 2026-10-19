
## 2024-03-10 - O(N²) array searches to O(1) Hash Maps lookup
**Learning:** In judging benchmarks and results array loops, we mapped over elements and used `.filter()`, `.findIndex()` or `.some()` which resulted in inefficient O(N²) complexity.
**Action:** When working on React components or trpc array calculations, avoid expensive nested iterations. Move derived array calculations to use pre-computed `Map` (hash maps), and take advantage of `Map.groupBy` to transform elements into O(1) loop-ups.
