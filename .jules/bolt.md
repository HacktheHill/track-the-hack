## 2024-05-19 - Pre-computing Hash Maps for Nested Iterations
**Learning:** Found O(A^2) performance bottleneck in `src/server/api/routers/judging.ts` where arrays were repeatedly iterated in nested `.filter()` and `.find()` over thousands of elements.
**Action:** Replace `array.find(item => item.id === targetId)` and `array.filter(item => item.a === a && item.b === b)` inside loops with `new Map()` built prior to the loop. Group arrays with `Map.groupBy` or reduce when filtering inside loops. This drops lookups from O(N) to O(1) inside iterations.
