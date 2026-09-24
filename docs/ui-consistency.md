# UI consistency

Shared controls live in `src/styles/globals.css`, with palette and geometry tokens in `src/styles/tokens.css`. They use the existing Hack the Hill colours, Rubik body text, and Coolvetica display headings.

## Language and typography

- Use British-Canadian English in all English user-facing copy: `colour`, `centre`, `organise`, `organisation`, `organiser`, and analogous forms. Use the team's licensed _Canadian Press Stylebook_ for other editorial questions; this explicit house spelling prevails where conventions differ.
- Use French-Canadian (`fr-CA`) copy for French interfaces. The project house style uses no space before `:`, `;`, `?`, or `!`.
- Apply these rules to rendered prose, validation messages, email templates, and participant- or organiser-facing documentation. Do not mechanically rename identifiers, CSS properties, APIs, data keys, dependencies, URLs, proper names, or quoted source material.
- Review replacements in their rendered context and preserve interpolation tokens and placeholders.

## Controls

- Use `ui-button` for secondary actions and button-like links. Add `ui-button-primary` for the single main action in a form or decision, and `ui-button-tertiary` for low-emphasis navigation or reversible account actions. All three use a 44px minimum height, 8px corner radius, 16px Rubik text, and consistent padding.
- Use `ui-button-icon` for square icon controls, and `ui-button-large` for the homepage call to action. Give icon controls an accessible name.
- Use `ui-field` for inputs, selects, and textareas. Set width with layout utilities such as `w-full`; normally use a visible label linked to the field ID. A compact field may use `aria-label` and a matching placeholder when its purpose is unambiguous in context, as on the scanner. Textareas keep a 112px minimum height and vertical resizing.
- Use `ui-checkbox` for native checkboxes and `ui-choice` beside an `sr-only peer` radio or checkbox. Keep the native input focusable.
- Use `ui-page-title` for page headings, `ui-panel` for bordered panels, and `ui-form-layout` for centred administrative forms.
- Use `disabled`, `aria-busy`, `aria-pressed`, and `aria-selected` to communicate the relevant control state. For validation, connect `aria-invalid` and `aria-describedby` to the inline error. Focus outlines appear immediately.
- Keep layout utilities at the call site. Avoid adding competing colours, padding, fonts, shadows, or corner radii to shared controls.

## Verification

Use the current route and workflow matrix in [`E2E_TESTING.md`](./E2E_TESTING.md).
Review changed components at the smallest supported phone width and desktop width,
exercise keyboard focus and error states, and verify both locales. Historical screenshot
galleries from removed application/account pages are not a current acceptance baseline.
