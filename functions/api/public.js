/**
 * PUBLIC-SAFE NEXTDNS ENDPOINT
 *
 * Returns aggregated analytics only. No logs, domains, devices, IPs,
 * profile configuration or API credentials are ever returned.
 */
export async function onRequest(context) {
  const key = context.env.NEXTDNS_API_KEY;
  const profile = context.env.NEXTDNS_PROFILE_ID;
  const publicName = context.env.PUBLIC_PROFILE_NAME || "Nazuaf DNS";

  if (!key || !profile) {
    return json({ error: "Public dashboard is not configured." }, 500);
  }

  const url = new URL(context.request.url);
  const requested = url.searchParams.get("range") || "24h";
  const configs = {
    "24h": { from: "-24h", interval: "1h" },
    "7d":  { from: "-7d",  interval: "1d" },
    "30d": { from: "-30d", interval: "1d" },
    "3m":  { from: "-3M",  interval: "1d" }
  };
  const cfg = configs[requested] || configs["24h"];

  try {
    const headers = { "X-Api-Key": key, "Accept": "application/json" };
    const base = `https://api.nextdns.io/profiles/${encodeURIComponent(profile)}/analytics`;
    const qs = `from=${encodeURIComponent(cfg.from)}&interval=${encodeURIComponent(cfg.interval)}&alignment=clock&partials=all&limit=500`;

    const [statusRes, encryptionRes, dnssecRes] = await Promise.all([
      fetch(`${base}/status;series?${qs}`, { headers }),
      fetch(`${base}/encryption?from=-24h&limit=100`, { headers }),
      fetch(`${base}/dnssec?from=-24h&limit=100`, { headers })
    ]);

    if (!statusRes.ok) throw new Error(`NextDNS status request failed (${statusRes.status})`);

    const statusJson = await statusRes.json();
    const encJson = encryptionRes.ok ? await encryptionRes.json() : { data: [] };
    const dnssecJson = dnssecRes.ok ? await dnssecRes.json() : { data: [] };

    const rows = Array.isArray(statusJson.data) ? statusJson.data : [];
    const times = Array.isArray(statusJson.meta?.series?.times) ? statusJson.meta.series.times : [];

    // Aggregate status categories into one anonymous value per time bucket.
    const series = times.map((time, i) => ({
      time,
      queries: rows.reduce((sum, row) => sum + num(Array.isArray(row.queries) ? row.queries[i] : 0), 0)
    }));

    // The headline cards intentionally remain 24-hour statistics.
    const status24 = await fetch(`${base}/status?from=-24h&limit=100`, { headers });
    if (!status24.ok) throw new Error(`NextDNS 24h status request failed (${status24.status})`);
    const status24Json = await status24.json();
    const status24Rows = Array.isArray(status24Json.data) ? status24Json.data : [];
    const queries24h = status24Rows.reduce((n, x) => n + num(x.queries), 0);
    const blocked24h = status24Rows
      .filter(x => String(x.status || "").toLowerCase() === "blocked")
      .reduce((n, x) => n + num(x.queries), 0);

    const encRows = Array.isArray(encJson.data) ? encJson.data : [];
    const encrypted24h = encRows
      .filter(x => x.encrypted === true || String(x.encrypted).toLowerCase() === "true" || String(x.encryption || "").toLowerCase() === "encrypted")
      .reduce((n, x) => n + num(x.queries), 0);

    const dnssecRows = Array.isArray(dnssecJson.data) ? dnssecJson.data : [];
    const dnssec24h = dnssecRows.some(x =>
      x.validated === true || String(x.validated).toLowerCase() === "true" ||
      String(x.status || "").toLowerCase() === "validated"
    );

    return json({
      publicName,
      generatedAt: new Date().toISOString(),
      queries24h,
      blocked24h,
      encrypted24h,
      dnssec24h,
      series
    });
  } catch (e) {
    return json({ error: "Unable to fetch public network statistics." }, 502);
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
