/**
 * DNS resolver check for the public dashboard.
 *
 * The browser first resolves a unique hostname under test.dnscheck.tools.
 * That DNS lookup therefore happens through the visitor's actual DNS path.
 * This endpoint only reads the resulting public watch page and returns a
 * privacy-minimized classification; resolver/client IPs are never returned.
 */
export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get("id") || "";

  if (!/^[0-9a-f]{6,16}$/i.test(id)) {
    return json({ ok: false, status: "invalid" }, 400);
  }

  try {
    const r = await fetch(`https://dnscheck.tools/watch/${id}`, {
      headers: { "Accept": "text/html,application/xhtml+xml" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!r.ok) return json({ ok: false, status: "pending" }, 200);

    const html = await r.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const nextdns = /nextdns|dns\.nextdns\.io/.test(text);

    if (nextdns) {
      return json({
        ok: true,
        status: "ok",
        provider: "NextDNS",
        message: "This device is using NextDNS."
      });
    }

    // The watch page may not have a resolver result immediately after the
    // browser's DNS lookup. Treat an empty/unfinished page as pending.
    const hasResolver = /dns resolver|your dns resolvers|resolver|nameserver/.test(text);
    if (!hasResolver || text.length < 80) {
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
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
