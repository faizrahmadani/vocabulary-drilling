# Member login (protected page)

## Status / surface

New user journey added on 2026-11-24. Surfaces: a **Member** button in the home header
(`src/components/HomeView.vue`), `src/components/MemberView.vue`, `src/components/LoginView.vue`,
and the Express endpoints in `server/index.js`. The four drill screens are unchanged.

## AS IS

Before this change there was no login and no server. All four screens (Home, Quiz, Flashcards,
Analytics) were open to anyone with the page, and all drill data lived in
`localStorage['vocabdrill.v1']`. There was no Member button and no protected content.

## TO BE

1. The home header has a **Member** button next to the theme toggle. Clicking it opens the
   Member screen; the other four screens remain reachable without a session.
2. On open, Member calls `GET /api/me` with cookies included:
   - `200` → shows **"You are signed in"** with the signed-in email and a **Log out** button.
   - `401` → shows the sign-in form.
   - any other/network failure → shows **"Member service unavailable"** with *Try again* and
     *Back home*. The drill screens keep working.
3. The form collects email + password and posts `POST /api/login`. A success sets an
   `HttpOnly` `vd_session` cookie (`SameSite=Lax`, 24 h, `Secure` in production) and returns to
   step 2. Any failure shows the same generic **"Invalid email or password"** message — it never
   reveals whether the email exists. A double submit is ignored while the first is in flight.
4. **Log out** posts `POST /api/logout` with `x-requested-with: XMLHttpRequest`, clears the
   cookie and returns to the sign-in form. The button is disabled while the request is in flight.
5. Credentials are created by the user, not by an agent: `npm run hash-pw` prints a bcrypt hash;
   the user puts it in `VD_SEED_HASH` along with `VD_SEED_EMAIL`, runs `npm run db:migrate` and
   `npm run seed-user`. There is no public registration endpoint.
6. Locally the backend listens on `127.0.0.1:3001` and Vite proxies `/api` to it, so the browser
   sees one origin. `VD_FRONTEND_ORIGIN` enables explicit cross-origin CORS if needed later.

### AS IS → TO BE summary

| Before | After |
|---|---|
| No auth surface at all | Member button + protected page with login/logout |
| Static SPA only | Static drills + optional Express/Postgres auth backend |
| All screens public | Member screen gated; four drill screens stay public and offline |

## Invariants

- `localStorage['vocabdrill.v1']` remains the only drill store; the backend never reads or
  writes it.
- The four drill screens load and work with the backend stopped.
- Passwords are never stored in source, `.env.example`, git or agent output; only a bcrypt hash
  lives in Postgres, and the secret is in `.env`/host env only.
- Session cookies are `HttpOnly`; verification is HMAC-SHA256 with `exp`, timing-safe comparison,
  and a dummy bcrypt hash for unknown emails.
- The CSRF header is required on `POST /api/logout`; CORS never uses `*`.
- Light/dark theme and mobile layout keep working on the new screen.

## Related

- [`../../README.md`](../../README.md) — Member page setup and login instructions.
- [`../README.md`](../README.md) — architecture, auth data flow, known limitations.
- [`../TESTING.md`](../TESTING.md) — auth test layers and manual browser smoke cases.
- [`../../AGENTS.md`](../../AGENTS.md) — workflow, red-team gate, explicit boundaries.
