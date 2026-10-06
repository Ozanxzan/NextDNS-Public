# Nazuaf DNS Public Dashboard

A privacy-safe public NextDNS dashboard deployed on Cloudflare Pages.

## Public data
- Aggregate query statistics
- Blocked queries and block rate
- Encrypted DNS percentage
- DNSSEC status
- Reasons for blocking
- NextDNS endpoint information
- Read-only security feature status

## Security feature status
The dashboard reads the NextDNS profile's Security configuration server-side using `NEXTDNS_API_KEY` and returns only boolean feature status to the public browser. No API key, DNS logs, domains, devices, or client IP addresses are exposed.

## Required Cloudflare Pages secrets
- `NEXTDNS_API_KEY`
- `NEXTDNS_PROFILE_ID`
- `PUBLIC_PROFILE_NAME`
