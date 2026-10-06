const $ = s => document.querySelector(s);
const fmt = n => Number(n || 0).toLocaleString("en-US");
function set(id, v) { const e = $("#" + id); if (e) e.textContent = v; }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

const ranges = {
  "24h": { label: "LAST 24H", api: "-24h", interval: "1h", axis: ["24h ago", "12h", "now"] },
  "7d":  { label: "LAST 7 DAYS", api: "-7d", interval: "1d", axis: ["7d ago", "3d", "now"] },
  "30d": { label: "LAST 30 DAYS", api: "-30d", interval: "1d", axis: ["30d ago", "15d", "now"] },
  "3m":  { label: "LAST 3 MONTHS", api: "-3M", interval: "1d", axis: ["3mo ago", "6w", "now"] }
};

let selectedRange = "24h";

function renderSeries() {
  // The public dashboard intentionally shows aggregate statistics without a graph.
}

function renderReasons(reasons) {
  const box = $("#reasonsList");
  if (!box) return;
  const rows = Array.isArray(reasons) ? reasons.slice(0, 6) : [];
  if (!rows.length) {
    box.innerHTML = '<div class="reason-empty">No blocking reason data available.</div>';
    return;
  }
  box.innerHTML = rows.map(row => {
    const name = String(row.name || row.id || "Unknown reason");
    const queries = fmt(row.queries);
    return `<div class="reason-row"><span>${escapeHtml(name)}</span><b>${queries}</b></div>`;
  }).join('');
}


function renderEndpoints(endpoints) {
  const box = $("#endpointsList");
  if (!box) return;
  const e = endpoints || {};
  const ipv6 = Array.isArray(e.ipv6) ? e.ipv6 : [];
  box.innerHTML = `
    <div class="endpoint-row"><strong>DNS-over-TLS/QUIC</strong><span class="endpoint-value">${escapeHtml(String(e.dot || "—"))}</span></div>
    <div class="endpoint-row"><strong>DNS-over-HTTPS</strong><span class="endpoint-value">${escapeHtml(String(e.doh || "—"))}</span></div>
    <div class="endpoint-row"><strong>IPv6</strong>${ipv6.length ? ipv6.map(v => `<span class="endpoint-value">${escapeHtml(String(v))}</span>`).join("") : '<span class="endpoint-value">—</span>'}</div>
  `;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
}



function setConnectionState(state, data = {}) {
  const card = $(".connection-check");
  const title = $("#connectionTitle");
  const message = $("#connectionMessage");
  const icon = $("#connectionIcon");
  const meta = $("#connectionMeta");
  const refresh = $("#connectionRefresh");
  if (!card || !title || !message || !icon || !meta || !refresh) return;

  card.classList.remove("is-ok", "is-warn", "is-error", "is-checking");
  icon.classList.remove("is-ok", "is-warn", "is-error", "is-checking");

  if (state === "ok") {
    card.classList.add("is-ok"); icon.classList.add("is-ok");
    title.textContent = "All good!";
    message.textContent = "This device is using NextDNS.";
    meta.hidden = false;
    set("connectionProtocol", String(data.protocol || "NextDNS"));
    set("connectionServer", String(data.server || "Connected"));
    set("connectionRoute", data.anycast ? "Anycast" : "Ultra-low latency");
  } else if (state === "unconfigured") {
    card.classList.add("is-warn"); icon.classList.add("is-warn");
    title.textContent = "NextDNS detected";
    message.textContent = "This device is reaching NextDNS, but no profile is currently attached.";
    meta.hidden = false;
    set("connectionProtocol", String(data.protocol || "Detected"));
    set("connectionServer", String(data.server || "NextDNS"));
    set("connectionRoute", data.anycast ? "Anycast" : "Direct");
  } else if (state === "warn") {
    card.classList.add("is-warn"); icon.classList.add("is-warn");
    title.textContent = "NextDNS detected";
    message.textContent = "This device reached NextDNS, but the detected configuration does not match the expected profile.";
    meta.hidden = false;
    set("connectionProtocol", String(data.protocol || "NextDNS"));
    set("connectionServer", String(data.server || "NextDNS"));
    set("connectionRoute", data.anycast ? "Anycast" : "Direct");
  } else if (state === "error") {
    card.classList.add("is-error"); icon.classList.add("is-error");
    title.textContent = "Not using NextDNS";
    message.textContent = "This device is not currently detected on NextDNS.";
    meta.hidden = true;
  } else {
    card.classList.add("is-checking"); icon.classList.add("is-checking");
    title.textContent = "Checking connection…";
    message.textContent = "Checking this device's current DNS connection.";
    meta.hidden = true;
  }
  refresh.disabled = state === "checking";
}

async function checkNextDNSConnection() {
  setConnectionState("checking");
  try {
    // The root test.nextdns.io endpoint is an HTML redirect/helper and is not
    // suitable for browser fetch(). NextDNS uses a random subdomain for the
    // actual JSON test endpoint, which is CORS-enabled.
    const token = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") :
      Math.random().toString(36).slice(2) + Date.now().toString(36));
    const r = await fetch(`https://${token}.test.nextdns.io/`, {
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (!r.ok) throw new Error("test request failed");
    const d = await r.json();
    const status = String(d.status || "").toLowerCase();
    if (status === "ok") {
      // NextDNS considers status=ok the authoritative signal that this
      // device is using NextDNS. Do not require a profile field or compare
      // the tester's encrypted/internal profile identifier with the public
      // configuration ID; they are not guaranteed to be the same.
      setConnectionState("ok", d);
    } else if (status === "mismatch") {
      setConnectionState("warn", d);
    } else {
      setConnectionState("error", d);
    }
  } catch (_) {
    setConnectionState("error");
  }
}

async function loadRange(rangeKey) {
  selectedRange = rangeKey;
  const cfg = ranges[rangeKey];
  const select = $("#rangeSelect");
  if (select && select.value !== rangeKey) select.value = rangeKey;

  try {
    const r = await fetch(`/api/public?range=${encodeURIComponent(rangeKey)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Unable to load public data");

    // The selected range controls the headline numbers too. Previously these
    // were only updated for 24h, so 7d/30d/3m looked empty even when the API
    // returned valid data.
    const q = Number.isFinite(Number(d.queries)) ? Number(d.queries) : Number(d.queries24h || 0);
    const b = Number.isFinite(Number(d.blocked)) ? Number(d.blocked) : Number(d.blocked24h || 0);
    const enc = Number.isFinite(Number(d.encrypted)) ? Number(d.encrypted) : Number(d.encrypted24h || 0);
    set("queries", fmt(q));
    set("blocked", fmt(b));
    set("rate", pct(b, q) + "%");
    set("encrypted", pct(enc, q) + "%");
    set("filtering", b > 0 ? "ACTIVE" : "READY");
    set("encState", enc > 0 ? "ACTIVE" : "—");
    set("dnssec", d.dnssec ? "ACTIVE" : (d.dnssec24h ? "ACTIVE" : "—"));

    set("networkState", "ONLINE");
    const updatedAt = new Date(d.generatedAt);
    const time = updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/:/g, ".");
    const date = updatedAt.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
    set("updated", "Updated " + time);
    set("updatedDate", date);
    set("profileName", d.publicName || "Nazuaf DNS");
    renderReasons(d.reasons || []);
    renderEndpoints(d.endpoints || {});
    renderSeries(d.series || [], rangeKey);
    checkNextDNSConnection();
  } catch (e) {
    set("networkState", "OFFLINE");
    set("updated", e.message);
  }
}

$("#rangeSelect")?.addEventListener("change", e => loadRange(e.target.value));
$("#theme")?.addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.theme = document.body.classList.contains("light") ? "light" : "dark";
});

if (localStorage.theme === "light") document.body.classList.add("light");
$("#connectionRefresh")?.addEventListener("click", checkNextDNSConnection);
loadRange(selectedRange);
setInterval(() => loadRange(selectedRange), 60000);
