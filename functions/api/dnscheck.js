/**
 * DNS resolver verification for the public dashboard.
 *
 * The browser creates a unique DNS lookup under test.dnscheck.tools.
 * dnscheck.tools associates that lookup with /watch/<id>. This endpoint
 * reads the public watch page and returns only a coarse classification.
 * Resolver IPs, client IPs and other identifying data are never returned.
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id") || "";

  if (!/^[0-9a-f]{12}$/i.test(id)) {
    return json({ ok: false, status: "invalid" }, 400);
  }

  try {
    const r = await fetch(`https://dnscheck.tools/watch/${id}?cb=${Date.now()}`, {
      method: "GET",
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "User-Agent": "Nazuaf DNS Checker/1.0"
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!r.ok) return json({ ok: false, status: "pending" });

    const html = await r.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (/nextdns|dns\.nextdns\.io/.test(text)) {
      return json({
        ok: true,
        status: "ok",
        provider: "NextDNS",
        message: "This device is using NextDNS."
      });
    }

    // A watch page may exist before the resolver result is populated.
    // Do not report a false negative until a resolver is actually visible.
    const resolverWords = /your dns resolvers|dns resolvers|resolver|nameserver/.test(text);
    const unfinished = /detecting|pending|loading/.test(text);

    if (!resolverWords || unfinished || text.length < 80) {
      return json({ ok: false, status: "pending" });
    }

    return json({
      ok: false,
      status: "other",
      provider: "Another DNS resolver",
      message: "This device is not currently using NextDNS."
    });
  } catch (_) {
    return json({ ok: false, status: "pending" });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
