## 2023-10-27 - Memoization with time-based implicit dependencies
**Learning:** Using `Date.now()` inside a render loop to filter data, combined with heavy array operations (`.filter`, `.sort`, `.reduce`), is an anti-pattern. Memoizing this directly breaks auto-updating functionality.
**Action:** Extract the current time into a piece of state (`now`) driven by `setInterval`, and include `now` in the `useMemo` dependency array. This achieves both memoization of the expensive work and periodic updates of the time-dependent view.
