## 2024-05-15 - Improve search input mobile UX
**Learning:** Using `type="search"` instead of the default `type="text"` on search inputs automatically triggers native mobile search keyboards and provides built-in browser clear buttons without requiring custom JS or CSS. This significantly improves the mobile user experience for filtering or searching lists.
**Action:** Always apply `type="search"` to `<input>` elements whose primary function is search/filtering, ensuring native mobile keyboards show the "Search" key instead of "Return/Enter".
