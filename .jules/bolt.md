## 2026-08-24 - Expensive derived data in render
**Learning:** Found an anti-pattern in `src/pages/schedule/index.tsx` and `src/pages/qr/index.tsx` where expensive array operations (filter, sort, reduce) are executed directly in the component body instead of being memoized with `useMemo`. This causes unnecessary recalculations on every render.
**Action:** When filtering or sorting data from tRPC queries in React components, wrap the operations in a `useMemo` hook to prevent recalculation on re-renders, especially when dealing with lists.
