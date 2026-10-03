## 2023-10-04 - Native Mobile Search Input Types
**Learning:** In the current codebase, search inputs (`<input>`) in hardware catalogs are missing the `type="search"` attribute. Without this, mobile devices won't show the "Search" key on the virtual keyboard and native clear buttons won't appear, leading to a degraded mobile experience.
**Action:** When adding or modifying search fields in React/Next.js, always add `type="search"` to `<input>` tags intended for search functionality to trigger optimized native mobile keyboards and built-in clearing behaviors.
