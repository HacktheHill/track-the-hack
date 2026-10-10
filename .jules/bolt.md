## 2024-10-10 - Replace Array.find with Map lookups in judging.ts

**Learning:** When matching relations dynamically (e.g. mapping `judgingAssignments` to `judgingProjects` and their nested `categories`), using `.find()` inside a `.map()` or `.filter()` results in an O(N^2) operation (or worse). In `judging.ts`, `resolutionFor` was doing a `.find()` on projects and then a `.find()` on categories on every call, leading to large overhead for thousands of assignments.
**Action:** Always build an O(1) hash map (`Map`) using composite keys before filtering/mapping over arrays to drastically reduce latency and CPU usage on high-cardinality lookups.
