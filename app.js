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


function eyeIcon(hidden = true) {
  return hidden
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a18.7 18.7 0 0 1-3.2 3.8M6.2 6.9C3.6 8.7 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.7"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
}

function maskedEndpoint(value) {
  const text = String(value || "—");
  if (text === "—") return text;
  return text.replace(/[^\s:/.-]/g, "*");
}

function endpointValue(value, key) {
  const raw = String(value || "—");
  return `<div class="endpoint-secret" data-endpoint-key="${escapeHtml(key)}" data-value="${escapeHtml(raw)}" data-hidden="true"><span class="endpoint-value endpoint-masked">${escapeHtml(maskedEndpoint(raw))}</span><button class="endpoint-eye" type="button" aria-label="Show endpoint" aria-pressed="false">${eyeIcon(true)}</button></div>`;
}

function renderEndpoints(endpoints) {
  const box = $("#endpointsList");
  if (!box) return;
  const e = endpoints || {};
  const ipv6 = Array.isArray(e.ipv6) ? e.ipv6 : [];
  const ipv6Html = ipv6.length
    ? ipv6.map((v, i) => endpointValue(v, `ipv6-${i}`)).join("")
    : endpointValue("—", "ipv6-0");

  box.innerHTML = `
    <div class="endpoint-row"><strong>DNS-over-TLS/QUIC</strong>${endpointValue(e.dot || "—", "dot")}</div>
    <div class="endpoint-row"><strong>DNS-over-HTTPS</strong>${endpointValue(e.doh || "—", "doh")}</div>
    <div class="endpoint-row"><strong>IPv6</strong>${ipv6Html}</div>
  `;

  box.querySelectorAll(".endpoint-eye").forEach(button => {
    button.addEventListener("click", () => {
      const wrap = button.closest(".endpoint-secret");
      if (!wrap) return;
      const hidden = wrap.dataset.hidden === "true";
      const value = wrap.dataset.value || "—";
      const valueEl = wrap.querySelector(".endpoint-value");
      if (valueEl) valueEl.textContent = hidden ? value : maskedEndpoint(value);
      wrap.dataset.hidden = String(!hidden);
      button.setAttribute("aria-pressed", String(hidden));
      button.setAttribute("aria-label", hidden ? "Hide endpoint" : "Show endpoint");
      button.innerHTML = eyeIcon(!hidden);
    });
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
}

function renderSecurityFeatures(security) {
  const box = $("#securityFeaturesList");
  if (!box) return;

  const cfg = security || {};
  const features = [
    ["Threat Intelligence Feeds", cfg.threatIntelligenceFeeds],
    ["AI-Driven Threat Detection", cfg.aiThreatDetection],
    ["Google Safe Browsing", cfg.googleSafeBrowsing],
    ["Cryptojacking Protection", cfg.cryptojacking],
    ["DNS Rebinding Protection", cfg.dnsRebinding],
    ["IDN Homograph Attacks Protection", cfg.idnHomographs],
    ["Typosquatting Protection", cfg.typosquatting],
    ["Domain Generation Algorithms (DGA) Protection", cfg.dga],
    ["Block Newly Registered Domains (NRDs)", cfg.nrd],
    ["Block Dynamic DNS Hostnames", cfg.ddns],
    ["Block Parked Domains", cfg.parking],
    ["Block Child Sexual Abuse Material", cfg.csam],
    ["Block Top-Level Domains (TLDs)", Array.isArray(cfg.tlds) && cfg.tlds.length > 0]
  ];

  box.innerHTML = features.map(([name, enabled]) => {
    const active = enabled === true;
    return `<div class="security-feature-row"><span class="security-feature-name">${escapeHtml(name)}</span><b class="security-feature-status${active ? "" : " off"}">${active ? "ACTIVE" : "OFF"}</b></div>`;
  }).join("");
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
    renderSecurityFeatures(d.security || {});

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
