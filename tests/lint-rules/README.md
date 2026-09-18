# Structure checks

These assert on **source text and file existence**. They are not security tests
and they are not end-to-end tests.

They live here because of audit finding H13. They used to sit in
`tests/authorization/` and `tests/e2e/`, where their location implied a
guarantee they never made — and that mattered:

- `admin-pages.test.ts` passed for **every** admin screen while nine of them
  flattened 401/403 into an inline error banner beneath a page still claiming
  `state="ready"`. It read `page.tsx` only, so logic one hop away was invisible;
  `"denied"` appeared in `AdminPageGate`'s own state union, so every screen
  satisfied the grep regardless of behaviour; and a **comment** claiming denial
  was "handled client-side" was the only reason one screen passed.
- Files named `*.e2e.ts` asserted that a list of paths existed. A reader
  reasonably assumed an end-to-end journey had been exercised. None had.

## What they are good for

Catching a screen or route that was never wired up, and drift between the
locked screen registry and the app tree. That is real value — it is just not
the value their old names advertised.

## What they cannot tell you

Whether a route authorizes, whether a denied user sees a denial, whether a
journey works, or whether any of it survives contact with a database. For that,
see `tests/authorization/` (executes the real `can()` pipeline),
`tests/tenant-isolation/` (runs against a real database as the restricted
application role), and `tests/integration/`.

## Rule of thumb

If a check can pass on a codebase where the feature is deleted from the
handler but the file still exists, it belongs here.
