# Local outbound TLS test identity

The PEM files are a synthetic self-signed identity for `hooks.example.test`, used only by the loopback integration tests. The private key is deliberately public test data, is not a production credential and must never be deployed. Generated with OpenSSL on 20 September 2026 with a ten-year validity period. A test-only HTTPS wrapper adds this certificate as a trusted CA for the successful/mismatch cases; real socket connections and certificate verification remain enabled. Production does not accept a CA/transport override through the public helper.
