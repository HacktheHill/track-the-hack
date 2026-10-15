## 2024-10-15 - Missing Search Input Type
**Learning:** Found multiple instances where search inputs in the codebase (e.g., in `src/pages/hardware.tsx` and `src/pages/internal/hardware.tsx`) use the default text input type instead of `type="search"`. Native search inputs provide better mobile keyboard layouts and often feature built-in clear buttons, improving usability for filtering lists.
**Action:** Always add `type="search"` to text inputs that act as filters/search bars.
