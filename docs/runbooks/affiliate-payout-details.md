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

## After deploying

Values saved before this change are still plain text. They keep working,
because reads accept them, but they must be encrypted. With the production
database owner URL and the production `LEARNER_BILLING_ENC_KEY`:

```bash
DIRECT_DATABASE_URL=... LEARNER_BILLING_ENC_KEY=... pnpm data:encrypt-affiliate-payouts
DIRECT_DATABASE_URL=... LEARNER_BILLING_ENC_KEY=... pnpm data:encrypt-affiliate-payouts -- --apply
```

The first command is a dry run and reports how many affiliates still hold plain
text. The second encrypts them. Run the dry run again and confirm it reports
`0`. The script is safe to re-run. It never overwrites a row that changed after
it read it; it reports how many it skipped, and running it again picks them up.

## Key rotation

Rotating `LEARNER_BILLING_ENC_KEY` makes existing gateway secrets and payout
details unreadable. There is no re-encryption tool yet. Before rotating, have
affiliates re-enter their details, or decrypt and re-encrypt with a one-off
script.
