# Outbound webhook protection (F06)

Tenant-configured webhook requests must use `safeOutboundFetch` from `@atlas/security/safe-outbound-fetch`. Marketing webhook delivery/tests and report destination delivery/tests already use this helper. Callers keep their existing request signatures and earlier cancellation signals.

## Enforced behavior

1. Parse an HTTP/HTTPS URL and reject embedded credentials or fragments. Error messages exclude the destination URL and payload.
2. Apply the optional deployment hostname allowlist before DNS. Resolve the hostname once with all addresses returned by the OS resolver. Reject the entire set if empty, invalid, mismatched with its address family, or containing any blocked address.
3. Select the first approved address and pin the native connection to it. The original URL hostname remains the HTTP Host and TLS server/certificate identity. Do not retry with a new DNS answer within the same request. Each delivery attempt gets a fresh validated resolution.
4. Use a fresh direct agent with automatic family selection disabled. Shared connection pools, global/environment proxies, caller dispatchers, socket paths and TLS/lookup overrides cannot alter this path. Explicit certificate verification remains enabled.
5. Never follow a redirect, including a redirect to another public address. Close redirect/upgrade responses immediately. Destroy the request on failure, cancellation and after fully buffering a successful response, including when the peer responds before reading the upload.

The policy blocks private, loopback, link-local/metadata, CGNAT, multicast, reserved and documentation IPv4 ranges. IPv6 is restricted to global unicast with conservative special-purpose/documentation/transition exclusions. IPv4-mapped IPv6 is evaluated against the embedded IPv4 address. Expanded/compressed spelling cannot bypass classification. Mixed public/private DNS sets are rejected even if the first address is public. This is intentionally stricter than simply asking whether an address is outside RFC1918.

Node supports a custom lookup for HTTP connections and preserves TLS identity when the hostname stays intact. See [Node HTTP request options](https://nodejs.org/api/http.html#httprequesturl-options-callback) and [Node HTTPS request options](https://nodejs.org/api/https.html#httpsrequesturl-options-callback). The conservative address policy was checked against the [IANA IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry/) and [IANA IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry/).

## Limits and compatibility

| Limit            | Behavior                                                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total deadline   | 15 seconds covering DNS, request-body preparation, connection/TLS, headers and complete response body. An earlier caller abort wins. A late DNS answer cannot start a request after cancellation. The OS DNS operation itself may finish in the background. |
| Request body     | At most 1 MiB. Oversized or stalled bodies fail before opening a connection.                                                                                                                                                                                |
| Response body    | At most 1 MiB, counted from received chunks even without Content-Length. Responses are buffered before the helper resolves; callers can still read text/JSON or inspect status.                                                                             |
| Response headers | Native parser limit of 16 KiB.                                                                                                                                                                                                                              |
| Compression      | Request `Accept-Encoding: identity`; reject non-identity encoded responses. No decompression allocation or compression-bomb path is introduced.                                                                                                             |
| Headers/options  | Reject caller Host, connection/framing/proxy/upgrade headers. Internal Host, length, identity encoding and close policy are authoritative. Node transport options are never copied from caller input.                                                       |
| Transport        | HTTP compatibility is preserved; configure production destinations as HTTPS and restrict permitted ports at the egress layer. No automatic redirect, proxy, address fallback or connection reuse.                                                           |

Integrations that insist on compressed responses, return very large bodies, use private destinations, supply URL userinfo/fragments, or require an environment proxy will fail under this policy. Configure the provider's final HTTPS webhook URL, move authentication to the appropriate header/signature, and return a small uncompressed acknowledgement. Do not work around rejection by switching these callers to ordinary `fetch` or disabling certificate checks. This helper serves bounded webhook exchanges; it is not a general streaming downloader or a complete implementation of every Fetch option.

Selecting one vetted address avoids alternate connection resolution. If a provider's first public address is unavailable, this attempt fails and the existing delivery retry policy can make a new validated attempt. The safety tradeoff is fewer transparent connection fallbacks and more TLS handshakes than a pooled client. Monitor latency/retries before increasing volume. A failure after sending may still mean the provider processed the payload; preserve existing idempotency/signature protections.

## Optional destination allowlist

Set `OUTBOUND_ALLOWED_HOSTS` consistently on API, web and worker when the deployment has a known set of integrations:

```dotenv
OUTBOUND_ALLOWED_HOSTS=hooks.partner.example,events.partner.example
```

Entries are exact, comma-separated hostnames. Use lowercase ASCII/punycode; bracket IPv6 literals. Do not include scheme, path, port, wildcard or suffix matching. A blank value preserves public-host compatibility. A listed host still goes through address validation and pinning. Tenant inputs cannot modify this environment setting. This setting is a runtime application policy, not a network firewall rule; changing it requires checking existing destinations before rollout.

## Deployment checks

1. Inventory active webhook destinations and their response behavior. Test each expected provider in staging with an approved test payload. Confirm the first validated address is reachable, TLS identity is correct, signatures/authentication still work, and acknowledgements fit the limits with identity encoding.
2. Use isolated test endpoints to verify redirect rejection, DNS changes, mixed A/AAAA answers, timeout behavior, size limits and retry outcomes. Do not probe real metadata or internal service endpoints.
3. Enforce outbound network restrictions for every API/web/worker runtime: deny private, loopback, link-local/metadata and other reserved ranges across IPv4 and IPv6; restrict destination ports/hosts as the infrastructure permits. Keep DNS resolver configuration controlled. DNS/address validation cannot detect a network that routes nominally public IP addresses into private services.
4. Apply the optional hostname allowlist only after inventory/testing, then restart all runtimes. Confirm expected deliveries still work and an unlisted hostname is rejected.
5. Monitor the existing delivery failure records, outbox retries and dead letters. Failure messages carry safe categories instead of destination secrets. Investigate spikes in blocked-address, timeout, oversized-body or encoded-response failures before replaying events.

The local F06 change does not provision egress firewall rules or deploy configuration. The socket tests use local fixture servers and a public test TLS key; no customer webhook payloads, production endpoints or internal services were probed. CI uses Node 22.13.1 while local verification ran on Node 24.11.1; tests avoid newer certificate-store APIs, but the CI run still needs to pass before release.
