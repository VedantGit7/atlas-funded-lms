# F06 independent security review

Read-only review by review_f06 on 20 September 2026. No files edited or external endpoints contacted by the reviewer.

Final result: no substantive outstanding concerns found. Reviewer independently ran the three outbound test suites: 91 tests passed on Node 24.11.1.

Reviewed DNS snapshot pinning, mixed-address rejection, IPv6 classification, URL/Host/TLS identity, redirects, caller option isolation, deadlines, body limits, socket cleanup and environment-proxy behavior. Installed Node source confirms that `agent: false` constructs a fresh native agent without global proxy settings.

Two findings were addressed: the initial TLS tests used certificate-store APIs newer than CI Node 22.13.1, and successful responses could remove the deadline before guaranteeing an early-response upload was closed. Tests now use a compatible test-only CA wrapper, and successful buffered responses explicitly destroy the request. A failing cleanup regression was recorded before the fix.

CI on Node 22 and real provider/hosting rollout checks remain pending; local test success is not a claim of deployment verification.
