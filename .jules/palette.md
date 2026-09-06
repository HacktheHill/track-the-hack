## 2024-03-27 - Added semantic accessibility roles to custom interactive component
**Learning:** Custom interactive components in this app (like Tabs) are frequently built with non-semantic HTML structures, lacking proper roles, keyboard accessibility (like tab index logic), and screen-reader association between the controllers (tabs) and the content (tabpanels).
**Action:** When building or enhancing interactive components (especially Tabs, Accordions, Modals), always ensure explicit ARIA roles (`role="tablist"`, `role="tab"`, `role="tabpanel"`) and associations (`aria-controls`, `aria-labelledby`, `aria-selected`) are implemented to support screen readers, alongside visible focus states for keyboard navigation.
## 2024-05-18 - ARIA Labels and Loading Indicators
**Learning:** Found several components, like the main Loading indicator and icon-only close buttons, missing ARIA labels or proper ARIA roles for screen readers. Added `role="status"` to loading indicator and proper translation strings for ARIA labels. I also made sure to hide purely decorative SVGs that have labels via `aria-hidden="true"`.
**Action:** Always check interactive icon buttons and loading spinners for ARIA attributes. Use the existing translation (`next-i18next`) keys available for `aria-label` properties.
## 2023-10-27 - [Fix Semantic Validation in Error Component]
**Learning:** Found a component using `<Link><button>...</button></Link>`. This is an accessibility anti-pattern because nesting interactive controls (like a button inside an anchor) is invalid HTML and confuses screen readers.
**Action:** Apply button styles and accessibility focus rings directly to the `<Link>` element instead of nesting.
