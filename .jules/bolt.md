## 2025-01-20 - [Avoid expensive map in render]
**Learning:** Found O(n) filtering/sorting arrays operations occurring directly in the render phase for `src/pages/schedule/index.tsx`. Specifically, `earlier`, `currentEvents` and `groups` are recalculated on every re-render (every component render, actually they recalculate on every map iteration `days.map(day => ...)` which is highly inefficient.
**Action:** Move array derivations using `useMemo` at the component level to prevent repetitive recalculations during the render cycle.
