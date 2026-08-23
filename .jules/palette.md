## 2024-08-23 - Augment Custom Interactive Components with ARIA and Focus Classes
**Learning:** Custom interactive components in this app (like Tabs) are frequently built with non-semantic HTML structures. This causes accessibility issues for keyboard and screen reader users.
**Action:** When acting as 'Palette', ensure these elements are augmented with explicit ARIA roles (e.g., `role="tablist"`, `role="tab"`, `role="tabpanel"`) and Tailwind focus ring classes (`focus-visible:ring-2 focus-visible:outline-none`) to support screen readers and keyboard navigation.
