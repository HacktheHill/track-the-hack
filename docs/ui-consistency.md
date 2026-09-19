# UI consistency

Shared controls live in `src/styles/globals.css`, with palette and geometry tokens in `src/styles/tokens.css`. They use the existing Hack the Hill colors, Rubik body text, and Coolvetica display headings.

## Controls

- Use `ui-button` for secondary actions and button-like links. Add `ui-button-primary` for form submission and primary actions. Both use a 44px minimum height, 8px corner radius, 16px Rubik text, and consistent padding.
- Use `ui-button-icon` for square icon controls, and `ui-button-large` for the homepage call to action. Give icon controls an accessible name.
- Use `ui-field` for inputs, selects, and textareas. Set width with layout utilities such as `w-full`; use a visible label linked to the field ID. Textareas keep a 112px minimum height and vertical resizing.
- Use `ui-checkbox` for native checkboxes and `ui-choice` beside an `sr-only peer` radio or checkbox. Keep the native input focusable.
- Use `ui-page-title` for page headings, `ui-panel` for bordered panels, and `ui-form-layout` for centered administrative forms.
- Use `disabled`, `aria-busy`, `aria-pressed`, and `aria-selected` to communicate the relevant control state. For validation, connect `aria-invalid` and `aria-describedby` to the inline error. Focus outlines appear immediately.
- Keep layout utilities at the call site. Avoid adding competing colors, padding, fonts, shadows, or corner radii to shared controls.

## Original verification (before the participant-model migration)

[Public before-and-after gallery](https://track-the-hack-ui-review.kai-song421505688.chatgpt.site) — 25 paired views with desktop and mobile screenshots, including the updated yellow user-list panels and walk-in button spacing. Include this link in the PR description for visual review.

The UI pass was checked in Chromium with an isolated local MySQL database and sample users/events. Desktop and mobile before/after captures cover 23 page templates, plus the application fields and attendee QR tabs. Shared-control geometry was checked at 320, 375, 414, 768, and 1440 pixels. The application is closed at `/apply`; its form was reviewed through a temporary local-only route that was removed after QA.

Interaction checks cover authentication field labels and focus, weak-password validation, the sign-up confirmation dialog, keyboard schedule filtering, attendee search, walk-in selection, confirmation button states, QR tab arrow keys, and application field errors. External email/OAuth services and physical camera scanning require separate integration checks.

The production build passed on Node 24.21.0. Type checking and ESLint passed with zero errors; four existing unused-variable warnings remain in the closed application route. All 115 page/viewport checks passed.

Run source checks with:

```sh
npx tsc --noEmit
npx eslint src/components src/pages
npm run build
```

The current repository provides `npm run lint` and `npm run typecheck`.

## Integration with the current app

The merge from `main` retains the organizer-only sign-in, participant passes, operational metrics, scanner workflow restrictions, and current validation/error handling. Legacy application, account-registration, and attendee-management pages removed by `main` stay removed. Shared control styling is applied to the replacement sign-in, scanner, and metrics screens. The gallery above documents the original design pass; it is not a verification of the replacement screens.
