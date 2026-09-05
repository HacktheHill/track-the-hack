## 2024-03-27 - Added semantic accessibility roles to custom interactive component
**Learning:** Custom interactive components in this app (like Tabs) are frequently built with non-semantic HTML structures, lacking proper roles, keyboard accessibility (like tab index logic), and screen-reader association between the controllers (tabs) and the content (tabpanels).
**Action:** When building or enhancing interactive components (especially Tabs, Accordions, Modals), always ensure explicit ARIA roles (`role="tablist"`, `role="tab"`, `role="tabpanel"`) and associations (`aria-controls`, `aria-labelledby`, `aria-selected`) are implemented to support screen readers, alongside visible focus states for keyboard navigation.
## 2024-05-18 - ARIA Labels and Loading Indicators
**Learning:** Found several components, like the main Loading indicator and icon-only close buttons, missing ARIA labels or proper ARIA roles for screen readers. Added `role="status"` to loading indicator and proper translation strings for ARIA labels. I also made sure to hide purely decorative SVGs that have labels via `aria-hidden="true"`.
**Action:** Always check interactive icon buttons and loading spinners for ARIA attributes. Use the existing translation (`next-i18next`) keys available for `aria-label` properties.

## 2026-09-05 - Adding aria-labels to interactive elements lacking visible labels
**Learning:** Interactive form elements like `<select>` that do not have visible `<label>` elements are inaccessible to screen readers. In this app, many such elements were found (like the language selector in Navigation and the event selector in QR).
**Action:** Always ensure that interactive form elements lacking a visible `<label>` are provided with an `aria-label`, utilizing the existing translation mechanism (`next-i18next`) to maintain localization support.
