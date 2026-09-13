## 2024-05-18 - Memoizing Expensive Derived State & Date.now()
**Learning:** Top-level pages receiving TRPC queries often execute expensive synchronous array operations (.filter, .sort, .reduce) and formatting directly in the render phase. When memoizing these with `useMemo`, implicit dependencies like `Date.now()` will break auto-updating behaviors.
**Action:** Wrap these derived data calculations in `useMemo` hooks. Replace implicit dependencies like `Date.now()` with state that periodically updates via `setInterval` to maintain auto-updating without sacrificing performance.
