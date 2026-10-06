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
loadRange(selectedRange);
setInterval(() => loadRange(selectedRange), 60000);
