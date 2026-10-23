## 2024-10-05 - Avoid O(N^2) array searches with Maps
**Learning:** Using `.find()` inside of loops like `.map()`, `.filter()`, or `.flatMap()` over large arrays leads to O(N^2) complexity, significantly degrading performance on large datasets.
**Action:** Always pre-compute a Hash Map (using `Map`) of the lookup data before looping for O(1) lookups instead.
