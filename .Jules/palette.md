## 2023-10-23 - Add `type="search"` to search inputs
**Learning:** For accessibility and mobile UX, applying `type="search"` to search inputs ensures native mobile search keyboards and built-in browser clear buttons are triggered without requiring custom JS or CSS.
**Action:** Always add `type="search"` to any `<input>` intended for filtering or searching lists, especially on pages accessed frequently from mobile devices (like the catalogue or hardware inventory).
