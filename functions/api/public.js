/**
 * PUBLIC-SAFE NEXTDNS ENDPOINT
 *
 * This is intentionally the ONLY public API endpoint.
 * It returns aggregated counters only.
 *
 * Never return:
 * - DNS logs
 * - domains
 * - devices
 * - profile configuration
 * - allow/deny lists
 * - API key
 * - raw NextDNS responses
 */
export async function onRequest(context) {
  const key = context.env.NEXTDNS_API_KEY;
  const profile = context.env.NEXTDNS_PROFILE_ID;
  const publicName = context.env.PUBLIC_PROFILE_NAME || "Nazuaf DNS";

  if (!key || !profile) {
    return json({error:"Public dashboard is not configured."},500);
  }

  try {
    // Keep the public window fixed at 24 hours.
    const qs = "from=-24h&limit=100";
    const headers = {
      "X-Api-Key": key,
      "Accept": "application/json"
    };

    const [status, encryption, dnssec] = await Promise.all([
      fetch(`https://api.nextdns.io/profiles/${encodeURIComponent(profile)}/analytics/status?${qs}`, {headers}),
      fetch(`https://api.nextdns.io/profiles/${encodeURIComponent(profile)}/analytics/encryption?${qs}`, {headers}),
      fetch(`https://api.nextdns.io/profiles/${encodeURIComponent(profile)}/analytics/dnssec?${qs}`, {headers})
    ]);

    if (!status.ok) throw new Error(`NextDNS status request failed (${status.status})`);

    const statusJson = await status.json();
    const encJson = encryption.ok ? await encryption.json() : {data:[]};
    const dnssecJson = dnssec.ok ? await dnssec.json() : {data:[]};

    const statusRows = Array.isArray(statusJson.data) ? statusJson.data : [];
    const encRows = Array.isArray(encJson.data) ? encJson.data : [];
    const dnssecRows = Array.isArray(dnssecJson.data) ? dnssecJson.data : [];

    // NextDNS analytics commonly exposes "queries"; keep aggregation tolerant.
    const queries24h = statusRows.reduce((n,x)=>n+num(x.queries),0);
    const blocked24h = statusRows
      .filter(x=>String(x.status||"").toLowerCase()==="blocked")
      .reduce((n,x)=>n+num(x.queries),0);

    const encrypted24h = encRows
      .filter(x=>x.encrypted===true || String(x.encrypted).toLowerCase()==="true" || String(x.encryption||"").toLowerCase()==="encrypted")
      .reduce((n,x)=>n+num(x.queries),0);

    const dnssec24h = dnssecRows.some(x =>
      x.validated===true || String(x.validated).toLowerCase()==="true" ||
      String(x.status||"").toLowerCase()==="validated"
    );

    // Build a deliberately anonymous hourly visualization from status rows
    // only if the API supplies timestamps. No raw domain/device data is returned.
    const hourly = new Array(24).fill(0).map((_,i)=>({hour:String(i).padStart(2,"0")+":00",queries:0}));
    for (const x of statusRows) {
      const q=num(x.queries);
      const ts=x.timestamp||x.time||x.date;
      if (ts) {
        const dt=new Date(ts);
        if (!isNaN(dt)) hourly[dt.getHours()].queries += q;
      }
    }

    return json({
      publicName,
      generatedAt:new Date().toISOString(),
      queries24h,
      blocked24h,
      encrypted24h,
      dnssec24h,
      hourly
    });
  } catch (e) {
    return json({error:"Unable to fetch public network statistics."},502);
  }
}

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=60, s-maxage=60",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
