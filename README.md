# Nazuaf DNS Public Dashboard

A privacy-safe public NextDNS dashboard deployed on Cloudflare Pages.

## Public data
- Aggregate query statistics
- Blocked queries and block rate
- Encrypted DNS percentage
- DNSSEC status
- Reasons for blocking
- NextDNS endpoint information
- Read-only security feature status (refreshed every 30 seconds)

## Security feature status
The dashboard reads the NextDNS profile's Security configuration server-side using `NEXTDNS_API_KEY` and returns only an allowlisted set of security flags to the public browser. It refreshes every 30 seconds and sends `Cache-Control: no-store` so the profile status is not served from a stale browser/CDN cache. Known NextDNS flags are shown as ACTIVE/OFF. Additional Early Access rows are included and populated when the API returns a recognized field or alias; otherwise they are explicitly shown as NOT EXPOSED (not incorrectly shown as OFF). IDN homograph and typosquatting protections are reported as INCLUDED IN AI when AI Threat Detection is enabled, because NextDNS documents those legacy fields as deprecated and integrated into AI Threat Detection. No API key, DNS logs, domains, devices, or client IP addresses are exposed.

## Required Cloudflare Pages secrets
- `NEXTDNS_API_KEY`
- `NEXTDNS_PROFILE_ID`
- `PUBLIC_PROFILE_NAME`
