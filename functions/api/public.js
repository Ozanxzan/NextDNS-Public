/**
 * PUBLIC-SAFE NEXTDNS ENDPOINT
 *
 * Returns aggregated analytics only. No logs, domains, devices, IPs,
 * profile configuration or API credentials are ever returned.
 *
 * The headline 24h statistics are intentionally kept independent from the
 * chart request. If a time-series request is rejected by the NextDNS API,
 * the public dashboard remains ONLINE and simply falls back to a single
 * aggregate chart point.
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

  const headers = {
    "X-Api-Key": key,
    "Accept": "application/json"
  };
  const base = `https://api.nextdns.io/profiles/${encodeURIComponent(profile)}/analytics`;

  try {
    // These are the critical requests. If status works, the dashboard is
    // considered healthy even when optional analytics/chart requests fail.
    const [statusRangeRes, status24Res, encryptionRes, dnssecRes] = await Promise.all([
      fetch(`${base}/status?from=${encodeURIComponent(cfg.from)}&limit=100`, { headers }),
      fetch(`${base}/status?from=-24h&limit=100`, { headers }),
      fetch(`${base}/encryption?from=${encodeURIComponent(cfg.from)}&limit=100`, { headers }),
      fetch(`${base}/dnssec?from=${encodeURIComponent(cfg.from)}&limit=100`, { headers })
    ]);

    if (!statusRangeRes.ok) {
      throw new Error(`NextDNS range status request failed (${statusRangeRes.status})`);
    }
    if (!status24Res.ok) {
      throw new Error(`NextDNS 24h status request failed (${status24Res.status})`);
    }

    const statusRangeJson = await statusRangeRes.json();
    const statusRangeRows = Array.isArray(statusRangeJson.data) ? statusRangeJson.data : [];
    const status24Json = await status24Res.json();
    const status24Rows = Array.isArray(status24Json.data) ? status24Json.data : [];

    const queries = statusRangeRows.reduce((n, x) => n + num(x.queries), 0);
    const blocked = statusRangeRows
      .filter(x => String(x.status || "").toLowerCase() === "blocked")
      .reduce((n, x) => n + num(x.queries), 0);

    const queries24h = status24Rows.reduce((n, x) => n + num(x.queries), 0);
    const blocked24h = status24Rows
      .filter(x => String(x.status || "").toLowerCase() === "blocked")
      .reduce((n, x) => n + num(x.queries), 0);

    const encJson = encryptionRes.ok ? await encryptionRes.json() : { data: [] };
    const encRows = Array.isArray(encJson.data) ? encJson.data : [];
    const encrypted = encRows
      .filter(x =>
        x.encrypted === true ||
        String(x.encrypted).toLowerCase() === "true" ||
        String(x.encryption || "").toLowerCase() === "encrypted"
      )
      .reduce((n, x) => n + num(x.queries), 0);

    // Keep 24h encryption too for backwards compatibility.
    let encrypted24h = encrypted;
    if (requested !== "24h") {
      try {
        const e24 = await fetch(`${base}/encryption?from=-24h&limit=100`, { headers });
        if (e24.ok) {
          const e24j = await e24.json();
          const e24rows = Array.isArray(e24j.data) ? e24j.data : [];
          encrypted24h = e24rows
            .filter(x => x.encrypted === true || String(x.encrypted).toLowerCase() === "true" || String(x.encryption || "").toLowerCase() === "encrypted")
            .reduce((n, x) => n + num(x.queries), 0);
        }
      } catch (_) {}
    }

    const dnssecJson = dnssecRes.ok ? await dnssecRes.json() : { data: [] };
    const dnssecRows = Array.isArray(dnssecJson.data) ? dnssecJson.data : [];
    const dnssec = dnssecRows.some(x =>
      x.validated === true ||
      String(x.validated).toLowerCase() === "true" ||
      String(x.status || "").toLowerCase() === "validated"
    );
    const dnssec24h = dnssec;

    // Try the requested time series separately. A chart failure must never
    // turn the whole public endpoint OFFLINE.
    let series = [];
    try {
      const qs = new URLSearchParams({
        from: cfg.from,
        interval: cfg.interval,
        alignment: "clock",
        partials: "all",
        limit: "500"
      });

      const seriesRes = await fetch(`${base}/status;series?${qs.toString()}`, { headers });
      if (seriesRes.ok) {
        const seriesJson = await seriesRes.json();
        const rows = Array.isArray(seriesJson.data) ? seriesJson.data : [];
        const times = Array.isArray(seriesJson.meta?.series?.times)
          ? seriesJson.meta.series.times
          : [];

        series = times.map((time, i) => ({
          time,
          queries: rows.reduce(
            (sum, row) => sum + num(Array.isArray(row.queries) ? row.queries[i] : 0),
            0
          )
        }));
      }
    } catch (_) {
      // Keep the endpoint healthy and use the aggregate fallback below.
    }

    // If NextDNS rejected the series request, show one truthful aggregate
    // point rather than an empty/offline dashboard.
    if (!series.length) {
      series = [{
        time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        queries: queries24h
      }];
    }

    return json({
      publicName,
      generatedAt: new Date().toISOString(),
      range: requested,
      queries,
      blocked,
      encrypted,
      dnssec,
      queries24h,
      blocked24h,
      encrypted24h,
      dnssec24h,
      series
    });
  } catch (_) {
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
