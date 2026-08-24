## 2024-05-18 - ARIA Labels and Loading Indicators
**Learning:** Found several components, like the main Loading indicator and icon-only close buttons, missing ARIA labels or proper ARIA roles for screen readers. Added `role="status"` to loading indicator and proper translation strings for ARIA labels. I also made sure to hide purely decorative SVGs that have labels via `aria-hidden="true"`.
**Action:** Always check interactive icon buttons and loading spinners for ARIA attributes. Use the existing translation (`next-i18next`) keys available for `aria-label` properties.
