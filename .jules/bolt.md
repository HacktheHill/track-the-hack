## 2024-10-01 - O(N^2) Array Searches in Render/Compute Loops
**Learning:** Found multiple instances of O(N^2) array search patterns in `src/server/api/routers/judging.ts`, specifically where `.find()` is called on arrays in `.map()` or `.filter()` inside tRPC routers (e.g. `resolutionFor` finding a project inside an assignment `.filter()`).
**Action:** Replace `.find()` lookups with O(1) Map lookups for performance improvements, especially when dealing with large arrays.
