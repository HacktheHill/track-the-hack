## 2024-05-15 - Unmemoized Render Arrays
**Learning:** Found an anti-pattern in `src/pages/schedule/index.tsx` where expensive array operations like `.filter`, `.sort` and `groupScheduleEvents` (which itself loops over arrays) were happening inside the render loop (`days.map`).
**Action:** Always move derived array calculations inside existing `useMemo` hooks (or create new ones) before the render phase to prevent O(n) or worse operations on every tick/re-render.
