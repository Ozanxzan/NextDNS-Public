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

function renderSeries(series, rangeKey) {
  const bars = $("#bars");
  if (!bars) return;
  bars.innerHTML = "";

  const values = Array.isArray(series) ? series : [];
  const max = Math.max(...values.map(x => Number(x.queries) || 0), 1);

  values.forEach((x, i) => {
    const b = document.createElement("i");
    b.className = "bar";
    const q = Number(x.queries) || 0;
    b.style.height = Math.max(3, Math.round(q / max * 100)) + "%";
    const d = x.time ? new Date(x.time) : null;
    const label = d && !Number.isNaN(d.getTime())
      ? d.toLocaleString([], { month: "short", day: "numeric", hour: rangeKey === "24h" ? "2-digit" : undefined, minute: rangeKey === "24h" ? "2-digit" : undefined })
      : `Period ${i + 1}`;
    b.title = `${label}: ${fmt(q)} queries`;
    bars.append(b);
  });

  const axis = ranges[rangeKey].axis;
  const axisEls = $("#chartAxis")?.querySelectorAll("span") || [];
  axisEls.forEach((el, i) => { if (axis[i]) el.textContent = axis[i]; });

  set("rangeBadge", ranges[rangeKey].label);
  set("rangeLabel", rangeKey === "24h" ? "LAST 24H" : ranges[rangeKey].label);
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

    if (rangeKey === "24h") {
      set("queries", fmt(d.queries24h));
      set("blocked", fmt(d.blocked24h));
      set("rate", pct(d.blocked24h, d.queries24h) + "%");
      set("encrypted", pct(d.encrypted24h, d.queries24h) + "%");
      set("filtering", d.blocked24h > 0 ? "ACTIVE" : "READY");
      set("encState", d.encrypted24h > 0 ? "ACTIVE" : "—");
      set("dnssec", d.dnssec24h ? "ACTIVE" : "—");
    }

    set("networkState", "ONLINE");
    set("updated", "Updated " + new Date(d.generatedAt).toLocaleTimeString());
    set("profileName", d.publicName || "Nazuaf DNS");
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
