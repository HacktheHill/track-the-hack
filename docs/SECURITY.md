# Security model and review

This document defines Track the Hack's security boundaries and the checks required
before a release. Report a suspected vulnerability privately to the repository owners.
Do not put credentials, participant capabilities, push endpoints, or personal data in
an issue, chat, screenshot, or test fixture.

## Trust boundaries

- Public schedule and sponsor routes expose only public content.
- Participant operations require a server-backed participant session or a scoped,
  signed capability. Participant identifiers are not credentials.
- Organiser operations require a current NextAuth session and a fresh database access
  check. Administrator-only operations also require `User.isAdmin`.
- Google Sheets integration routes require a constant-time comparison of a bearer key
  held in Apps Script properties.
- Database queries use Prisma parameters. External push destinations are restricted to
  the documented HTTPS push-service domains.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for data ownership and the complete
authorisation model.

## Browser protections

`next.config.js` applies these controls to every route:

- a Content Security Policy that blocks framing, plug-ins, unknown resource origins,
  and changes to the document base URL;
- `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`;
- a restrictive Permissions Policy that keeps camera access available for the same
  origin scanner and disables unused sensitive features;
- same-origin opener isolation and a strict referrer policy; and
- HSTS when a production build is configured with an HTTPS `NEXTAUTH_URL`.

API handlers set `Cache-Control: no-store`, and framework identification is disabled.

Pages Router bootstrap scripts and the existing component styles require the policy's
documented inline script and style allowances. Development alone also permits the
evaluation and WebSocket sources required by the local bundler. Tighten these
allowances only with a tested nonce-based migration.

Cookie-authenticated participant mutations reject a mismatched origin or a browser
request marked as cross-site. NextAuth provides its own anti-CSRF controls. Participant
cookies are opaque, `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Participant
sessions are also checked against active server-side state, so sign-out and reissue
invalidate an old cookie immediately.

## Secrets and sensitive values

- Keep all values described as secrets in `.env` or the deployment secret store.
- Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` may be exposed to browser code. It is a public
  signing-key counterpart, not a credential.
- Never log request bodies on capability endpoints. Current handlers return generic
  errors and deliberately omit caught exceptions where they may contain a token.
- Keep RSVP, cancellation, and claim capabilities in URL fragments. Fragments do not
  enter the initial HTTP request or normal referrer headers.
- Use different random values for NextAuth, participant sessions, claims,
  cancellations, the Sheets integration, and the internal bot API.
- Rotate a secret after suspected exposure. Existing links or sessions tied to that
  secret will stop working, so coordinate participant communications first.

## Verification

Run the normal gate plus the dependency audit:

```sh
npm audit
npm run verify:dev
```

When security headers, authentication, caching, or deployment configuration changes,
serve the production build and inspect one public route, one protected route, and one
API response. Other changes do not need to repeat that live check.

Dependency auditing checks published advisories. It does not prove that an application
has no vulnerabilities. Review authorization, validation, state transitions, external
requests, logging, and generated browser policy whenever those areas change.
