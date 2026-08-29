## 2024-03-27 - Added semantic accessibility roles to custom interactive component
**Learning:** Custom interactive components in this app (like Tabs) are frequently built with non-semantic HTML structures, lacking proper roles, keyboard accessibility (like tab index logic), and screen-reader association between the controllers (tabs) and the content (tabpanels).
**Action:** When building or enhancing interactive components (especially Tabs, Accordions, Modals), always ensure explicit ARIA roles (`role="tablist"`, `role="tab"`, `role="tabpanel"`) and associations (`aria-controls`, `aria-labelledby`, `aria-selected`) are implemented to support screen readers, alongside visible focus states for keyboard navigation.
## 2024-05-18 - ARIA Labels and Loading Indicators
**Learning:** Found several components, like the main Loading indicator and icon-only close buttons, missing ARIA labels or proper ARIA roles for screen readers. Added `role="status"` to loading indicator and proper translation strings for ARIA labels. I also made sure to hide purely decorative SVGs that have labels via `aria-hidden="true"`.
**Action:** Always check interactive icon buttons and loading spinners for ARIA attributes. Use the existing translation (`next-i18next`) keys available for `aria-label` properties.

## 2024-11-20 - Adding explicit ARIA roles and focus rings to custom Modals
**Learning:** In this Next.js app, interactive components (like Modals) are frequently built using generic `<div>` wrappers instead of semantic elements. They lack explicit ARIA roles such as `role="dialog"` or `aria-modal="true"`. Also, custom interactive elements often miss visible focus states (`focus-visible:ring-2`) necessary for keyboard navigation.
**Action:** When working on custom interactive elements (tabs, modals, generic buttons), always verify and augment them with explicit ARIA roles and Tailwind `focus-visible` classes to ensure they are fully accessible to screen readers and keyboard users.
