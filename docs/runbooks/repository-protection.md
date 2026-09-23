# Repository protection and emergency exceptions

## Current rollout status

F10 is **prepared, not enforced or closed**. The connected GitHub account can read repository metadata but its managed integration cannot administer branch protection. GitHub also returns a private-repository plan restriction for rulesets. See the [F10 report](../engineering/f10-repository-protection-remediation.md) and [dated live evidence](../engineering/audits/2026-09-20/f10-hosted-status.json).

The desired configuration is [atlas-release-protection.json](../../.github/rulesets/atlas-release-protection.json). Committing this file does not create a GitHub rule. Its `active` value describes the state after import, not the current repository state.

## Preconditions

1. The repository owner must enable an eligible plan for this private repository. The current repository is personally owned by `VedantGit7`; GitHub's response requests GitHub Pro. Keep it private. No subscription was purchased during this remediation. [GitHub ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
2. Use a signed-in repository administrator through GitHub settings, or an independently authorized client with repository Administration write permission. The current connector has no protection/ruleset mutation tool and its branch-protection read is forbidden. The repository metadata's `admin: true` describes account access and does not override integration permissions.
3. Publish the reviewed F09 candidate through the normal repository process and obtain a real hosted `ci-required` result. Confirm its publisher is GitHub Actions, app ID `15368`, before binding the required check. This ID is observed in the existing branch's check configuration, but the new aggregate has not yet run remotely. Do not activate an unavailable check and then bypass it to get releases through.
4. Establish an independent eligible code owner for changes authored by `VedantGit7`. The current CODEOWNERS file lists only that account. The additional reviewer needs repository write access and must appear on every applicable CODEOWNERS line, including later path-specific lines that override the wildcard. Put that coverage on the target/base branch before activation. A username has not yet been designated or granted access. Authors cannot approve their own PRs, and owners need write access. [Review rules](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request), [CODEOWNERS behavior](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

## Desired settings

| Area              | Configuration                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Targets           | Current default branch, explicit `main`, and both single-level and nested `release/` branches                 |
| Enforcement       | Active, no excluded refs, no bypass actors (including admins/apps/deploy keys)                                |
| Pull requests     | Required; at least one approving review; code-owner approval                                                  |
| New changes       | Dismiss stale approvals; require approval of the latest reviewable push by someone other than its pusher      |
| Review discussion | All review threads resolved                                                                                   |
| CI                | `ci-required`, publisher integration `15368`, strict/up-to-date testing; checks also apply on branch creation |
| History           | Force pushes blocked; deletion blocked                                                                        |
| Existing policy   | Retain existing classic protection and other rulesets; this is additive                                       |

The two release patterns cover `release/v1` and `release/v1/hotfix` using GitHub's path-aware matching. `develop` is not a release target in this payload. If the default branch changes, update CI's branch filters to run for the new default before renaming it. [Pattern semantics](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

## Apply and read back

After the preconditions are met, open [repository ruleset settings](https://github.com/VedantGit7/atlas-funded-lms/settings/rules). First inspect/export existing rules. If `Atlas release protection` already exists, compare and update that rule instead of creating a duplicate. Otherwise use **New ruleset → Import a ruleset**, select the JSON file, review the targets, active state, checks and empty bypass list, then create it. Preserve all unrelated settings. [Import instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository).

An authorized administrative REST client can alternatively send the exact JSON body to `POST /repos/VedantGit7/atlas-funded-lms/rulesets`; use `PUT /repos/VedantGit7/atlas-funded-lms/rulesets/{ruleset_id}` only for the identified matching rule after reviewing its existing settings. Do not put access tokens in this repository or chat. These API calls have not been executed. [Rules API](https://docs.github.com/en/rest/repos/rules).

Record the new ruleset ID, timestamp, acting administrator, and exported response. Read back its detail with an administrator-capable identity so bypass actors are visible. Confirm `active`, the exact branch conditions, an empty bypass list, and every setting above. Then read effective rules from `GET /repos/VedantGit7/atlas-funded-lms/rules/branches/main` and the equivalent URL-encoded release branch names. This endpoint exposes active rules, not disabled/evaluation rules. The current connector does not support that URL, so use the administrator's client or the branch Rules page. Treat any inaccessible or incomplete result as unverified.

## Acceptance matrix

Use disposable documentation-only test PRs against protected branches for read-only mergeability checks, and a disposable branch with the same rules for destructive-operation probes. Do not attempt a failed-check merge, deletion, or force push against real main/release history merely to test whether protection works: if enforcement is absent, such an operation could succeed.

| Case                                        | Expected result and evidence                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ci-required` absent or failed              | Merge unavailable to ordinary writer and administrator; retain PR/check links and both identities' blocked-state evidence    |
| Required review missing                     | Merge unavailable even with successful CI                                                                                    |
| New reviewable commit after approval        | Previous approval invalidated; fresh independent approval required                                                           |
| Author/last pusher tries to supply approval | Does not satisfy required independent approval                                                                               |
| Review thread unresolved                    | Merge blocked until resolution                                                                                               |
| Base branch advances                        | Updated candidate must pass the required check                                                                               |
| Direct push, force push, or deletion        | Reject for writer and administrator on an identically protected disposable branch; verify main/release effective rules match |
| Reviewed, current, passing candidate        | Merge eligibility available for the exact tested SHA; no production merge required for proof                                 |

Capture the GitHub ruleset export/effective rules, actual run IDs and SHAs, actor roles, blocked merge state, and rejection messages. Label a disposable-branch test as such; it does not alone prove main's target coverage. If an expected rejection instead succeeds, stop the probe, retain the evidence, and remediate the rules rather than marking F10 complete. Close disposable PRs and clean up only their test resources through an authorized exception if protection prevents deletion.

GitHub administrators can still edit repository rules. An empty bypass list prevents routine merge/push bypass under the active rule; it cannot make the policy immutable against its owner. Restrict administrative access to those who need it and review rule changes independently. A personal repository cannot establish separation of duties while one person controls both policy and all reviews.

## Emergency exception procedure

The normal rule has no standing bypass. An incident is not a reason to silently disable protection or make the repository public.

1. Record an incident/change reference, exact PR and candidate SHA, failed obligation, business reason, compensating checks, rollback target, named operator, independent approver, and a maximum 60-minute exception window. If no independent approver is available, escalate and record that required approval is missing; do not call the change compliant.
2. Export the original ruleset and all overlapping protection first. Have the authorized administrator make only the narrow, documented temporary exception. Prefer a named actor restricted to pull requests if the account's ruleset interface supports it. Do not use an unlogged exemption or disable unrelated rules. If no narrow exception is available, stop and obtain explicit approval for the exact broader policy change.
3. Record the settings change and any bypass/merge event with its actor, time, candidate SHA and reason. Check both ruleset history and available Rule Insights; retain a separate incident record if the plan does not offer sufficient audit history.
4. Restore the original policy immediately after the one authorized change or when the window expires, whichever is earlier. Read back the empty bypass list, active state and required checks/reviews. Have the independent approver verify restoration and save the evidence.
5. Complete the failed checks and incident follow-up. An emergency exception never changes failed CI evidence into a pass.

## Closing F10

F10 closes only after the rule is active, administrative and ordinary merge paths are verified, review coverage works, the acceptance evidence is retained, and no temporary exception remains. A formatted JSON payload, a successful local assertion, or an account-level administrator flag cannot satisfy this condition.
