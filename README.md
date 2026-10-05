# Nazuaf NextDNS — Public Dashboard

A public-safe NextDNS dashboard for Cloudflare Pages.

## Important security design

This version is deliberately different from an admin dashboard.

The browser can call only:

`GET /api/public`

The public endpoint returns only:

- aggregated 24-hour query count
- aggregated 24-hour blocked count
- aggregate encrypted-DNS count
- aggregate DNSSEC status
- anonymous hourly query totals
- a public display name

It does **not** return:

- DNS logs
- queried domains
- device names or IDs
- allowlist / denylist
- profile configuration
- profile ID
- API key
- raw NextDNS API responses

There are no POST/PATCH/DELETE public routes.

## Cloudflare Pages setup

Add these as **Secrets / Environment Variables**:

### `NEXTDNS_API_KEY`
Your fresh NextDNS API key.

### `NEXTDNS_PROFILE_ID`
The NextDNS profile ID whose aggregate statistics should be displayed.

### `PUBLIC_PROFILE_NAME`
Optional. Example:

`Nazuaf DNS`

Do not put any of these values in HTML, JavaScript, CSS, GitHub, or the browser.

## Deploy

Connect the repository to Cloudflare Pages.

- Framework preset: None
- Build command: empty
- Build output directory: `/`

The `functions/api/public.js` file is automatically deployed as a Pages Function.

## Public endpoint

The endpoint intentionally exposes only aggregate statistics:

`/api/public`

Even if somebody opens this URL directly, it does not expose the NextDNS API key or private DNS activity.

## API key rotation

If an old API key has ever appeared in a screenshot, repository, browser source, or public chat, generate a new key and replace the Cloudflare Secret.

## Caveat

The NextDNS API is documented as beta and may change. The public function keeps the upstream response private and exposes a small, fixed response schema.
