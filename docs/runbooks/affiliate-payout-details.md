# Affiliate payout details

Audit finding M6. Affiliates' bank account, IFSC, UPI id and account holder name
are stored encrypted and shown masked.

## How it works

- **Encryption:** each value is AES-256-GCM ciphertext (`enc:v1:…`) in the
  existing `sales_affiliates` columns. The key is derived (HKDF) from
  `LEARNER_BILLING_ENC_KEY`, so payment-gateway secrets and payout details never
  share a key. Each value is bound to its tenant, affiliate and field: a value
  copied to another row or column fails to decrypt.
- **Masked by default:** the affiliate's own page and the admin partner list
  show `•••• 1234` for the bank account and `ad•••@okhdfc` for the UPI id. IFSC
  and the account holder name are shown in full.
- **Full details:** an admin paying an affiliate uses **Show full details to
  pay** on the partner. It calls
  `POST /api/v1/sales/affiliates/partners/[id]/payout-details`, which requires
  step-up MFA and writes `affiliate.payout_details.revealed` to the audit log.
- **Changes:** editing a partner requires step-up MFA, because it can change
  where commissions are paid. Payout changes are audited as
  `affiliate.payout_details.updated` and `affiliate.partner.updated`, with field
  names only, never values. On both forms an empty bank account or UPI field
  keeps what is on file; removing one is an explicit choice.

## After deploying: the backfill

Values saved before this change are still plain text. They keep working,
because reads accept them, but they must be encrypted. Run the backfill once
per environment (staging first, then production) after the M6 code is live.

You need:

- the database **owner** URL, as a login with `BYPASSRLS` (or a superuser).
  `sales_affiliates` forces row-level security, and an owner without
  `BYPASSRLS` sees no rows at all; the script refuses such a login rather than
  report a clean table that is not;
- the environment's own `LEARNER_BILLING_ENC_KEY`, the one the API runs with.

```bash
# 1. Dry run: counts only, never values. Exits 1 while plain text remains.
DIRECT_DATABASE_URL=... LEARNER_BILLING_ENC_KEY=... pnpm data:encrypt-affiliate-payouts

# 2. Optional: one tenant first.
... pnpm data:encrypt-affiliate-payouts -- --apply --tenant <tenant-id>

# 3. Everyone.
... pnpm data:encrypt-affiliate-payouts -- --apply

# 4. Confirm: reports 0 and exits 0.
... pnpm data:encrypt-affiliate-payouts
```

What the script guarantees:

- **The key is proven before anything is written.** It must decrypt the
  ciphertext already in the database (payment gateway secrets, and payout
  values saved since M6). If it does not, the script stops with exit code 2 and
  changes nothing: a wrong key would make every affiliate's details unreadable.
  When there is nothing to check it against (no gateway configured and no
  payout saved since M6), the dry run says `Key: no existing ciphertext`, and
  `--apply` additionally needs `--allow-unverified-key`. Compare the key with
  the deployment's secret before passing it.
- **Every value is verified before it is stored.** Each affiliate is encrypted
  in its own short transaction: the row is locked, each value sealed and opened
  again, and the row is written only if all of them round-trip. An affiliate
  that fails is left unchanged and listed by id; nothing else is affected.
- **Concurrent edits are safe.** An edit made during the run waits for the row
  lock and is never overwritten; a value already encrypted is left alone.
- **Safe to re-run.** Exit codes: `0` no plain text remains, `1` some does, `2`
  refused to run (wrong key, login cannot see every row, bad arguments).

Record the final dry-run output (counts only) in the release evidence.

## Key rotation

Rotating `LEARNER_BILLING_ENC_KEY` makes existing gateway secrets and payout
details unreadable. There is no re-encryption tool yet. Before rotating, have
affiliates re-enter their details, or decrypt and re-encrypt with a one-off
script.
