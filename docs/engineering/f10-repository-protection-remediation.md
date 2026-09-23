# F10 repository protection remediation

## Status — 20 September 2026

**Prepared locally; blocked from activation; F10 remains open.** The importable ruleset and operational procedure are ready. No GitHub rules, collaborators, branch refs, subscription, or repository visibility have been changed.

## Fresh evidence

Checked `VedantGit7/atlas-funded-lms` using the connected `VedantGit7` account. The repository is private, its default branch is `main`, and account metadata reports administrator permissions. Main currently points to `d15794708e6a2d0231286612e4bc573e92deb619`.

| Read                     | Result                                                                                  | Interpretation                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Repository metadata      | Private; account `admin: true`                                                          | Account access is not equivalent to integration administrative capability                                 |
| Main branch summary      | `protected: false`, nested `protection.enabled: true`, checks enforced for `non_admins` | Contradictory summary cannot establish effective protection; does not establish administrator enforcement |
| Detailed main protection | HTTP 403, resource inaccessible to integration                                          | Current managed connection cannot inspect the administrative protection endpoint                          |
| Repository rulesets      | HTTP 403 requesting GitHub Pro or public visibility                                     | Private-repository plan is a concrete blocker; keep the repository private                                |
| Effective branch rules   | Connector rejects endpoint as unsupported                                               | Requires another authorized administrative client or signed-in settings page for verification             |

The summary lists 18 older required checks but not F09's `ci-required`. F09's aggregate is still a local uncommitted change and has not completed a hosted run. Raw sanitized results, including the existing check publisher IDs, are saved in [live evidence](audits/2026-09-20/f10-hosted-status.json).

GitHub documents private-repository rulesets on eligible paid plans and requires Administration write permission for rule creation. The connected tool exposes ruleset reads but no ruleset/protection mutation. These are GitHub plan/API capability limitations, not an automatic approval-review rejection. [Ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [administrative API](https://docs.github.com/en/rest/repos/rules).

## Prepared remediation

[Ruleset payload](../../.github/rulesets/atlas-release-protection.json) targets default/main and `release/` branches, with no bypass actors. It requires a pull request, one code-owner approval, fresh approval after new changes, independent last-push approval, resolved review threads, and up-to-date `ci-required` from publisher `15368`. It blocks force pushes and deletion. Existing classic protection and rulesets remain in place.

[Repository protection runbook](../runbooks/repository-protection.md) covers import/readback, preservation of existing settings, positive and negative enforcement checks for ordinary and administrator identities, safe disposable-branch probes, and independently approved, time-bounded emergency exceptions. Administrative rule editing remains a governance risk even when routine bypass is disabled.

An additional prerequisite emerged: CODEOWNERS lists only `VedantGit7`. Owner-authored PRs need another trusted write-capable code owner, including on the later path-specific ownership lines. No additional collaborator was invented or granted access. GitHub rejects an author's own approval. [Review documentation](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request).

## Verification and remaining work

Local validation checks the JSON structure and its alignment with F09's real job name, branch triggers and ownership protection. Results and source hashes are saved in [verification evidence](audits/2026-09-20/f10-verification.json). Local configuration validation does not prove that GitHub accepted or enforces the payload. No application behavior changed; a full application test/build would not resolve this external access/plan blocker.

To complete F10:

1. Enable an eligible private-repository plan for the owning account and make an administrator-capable settings session/client available.
2. Designate an independent trusted code owner with existing or explicitly authorized write access.
3. Publish and verify the F09 aggregate on a real candidate; confirm its check publisher.
4. Import the prepared ruleset, read back effective main/release rules, then retain ordinary/admin rejection and valid-candidate acceptance evidence according to the runbook.

Do not mark F10 resolved until these steps are complete. No paid upgrade or security-policy bypass was attempted.
