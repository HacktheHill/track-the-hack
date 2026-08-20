## 2024-10-18 - Anti-pattern: Synchronous Data Processing in React Render Phase
**Learning:** Found a common anti-pattern in Next.js pages (like `schedule/index.tsx`) where expensive array operations (`.filter`, `.sort`, `.reduce` chaining along with `toLocaleDateString()`) are executed directly in the component's render body, blocking the main thread during hydration and updates.
**Action:** When observing derived state derived from tRPC query data, wrap these array and formatting operations in a `useMemo` hook with relevant dependencies (e.g. `query.data`) to minimize UI thread blocking.
