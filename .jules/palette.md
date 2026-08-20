## 2024-05-24 - Accessibility on language selector
**Learning:** Found that standalone global inputs, such as the language selector `<select>` element in the navigation, are missing necessary ARIA labels which make them difficult for screen readers to interpret. They also lacked explicit focus-visible styles.
**Action:** Always verify that input elements, especially icon-only buttons or standalone selects, have proper `aria-label`s (using translation keys if necessary) and keyboard focus styles (e.g., `focus-visible:ring`).
