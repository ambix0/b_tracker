const cfg = window.BFM_CONFIG;
const $ = s => document.querySelector(s);

const todayISO = () => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const m = Object.fromEntries(p.map(x => [x.type, x.value]));
  return `${m.year}-${m.month}-${m.day}`;
};

const fmtDate = d => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata"
}).format(new Date(d + "T00:00:00"));

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

async function api(path) {
  const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: cfg.SUPABASE_KEY,
      "Content-Type": "application/json"
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

let schemes = [];
let updates = [];
let selectedDate = todayISO();

async function loadData() {
  $("#message").textContent = "Loading…";
  try {
    [schemes, updates] = await Promise.all([
      api("schemes?select=id,scheme_name,jal_mitra_name&order=scheme_name"),
      api("bfm_updates?select=scheme_id,update_date,status,created_at&order=created_at.desc&limit=1000")
    ]);

    $("#today").textContent = fmtDate(selectedDate);
    renderStats();
    render();
    $("#message").textContent = "";
  } catch (e) {
    $("#message").textContent = "Unable to load dashboard. Please try again.";
    console.error(e);
  }
}

function renderStats() {
  const todays = updates.filter(x => x.update_date === selectedDate);
  const updated = todays.filter(x => x.status).length;

  $("#total").textContent = schemes.length;
  $("#updated").textContent = updated;
  $("#pending").textContent = Math.max(0, schemes.length - updated);
  $("#completion").textContent =
    schemes.length ? Math.round(updated / schemes.length * 100) + "%" : "0%";
}

function statusFor(schemeId, date) {
  const row = updates.find(
    x => Number(x.scheme_id) === Number(schemeId) && x.update_date === date
  );
  return row ? !!row.status : null;
}

function render() {
  const q = ($("#search").value || "").trim().toLowerCase();

  const filtered = schemes.filter(s =>
    !q ||
    String(s.scheme_name || "").toLowerCase().includes(q) ||
    String(s.jal_mitra_name || "").toLowerCase().includes(q)
  );

  $("#thead").innerHTML = `
    <tr>
      <th>Scheme</th>
      <th>Jal Mitra</th>
      <th>Today</th>
    </tr>`;

  $("#tbody").innerHTML = filtered.map(s => {
    const st = statusFor(s.id, selectedDate);
    const badge = st === true
      ? '<span class="badge yes">✓</span>'
      : st === false
        ? '<span class="badge no">✕</span>'
        : '<span class="badge empty">—</span>';

    return `
      <tr>
        <td>${esc(s.scheme_name)}</td>
        <td>${esc(s.jal_mitra_name)}</td>
        <td>${badge}</td>
      </tr>`;
  }).join("") || `<tr><td colspan="3" class="muted center">No matching schemes.</td></tr>`;

  $("#mobileCards").innerHTML = filtered.map(s => {
    const st = statusFor(s.id, selectedDate);
    const badge = st === true
      ? '<span class="badge yes">✓</span>'
      : st === false
        ? '<span class="badge no">✕</span>'
        : '<span class="badge empty">—</span>';

    return `
      <div class="scheme-card">
        <div class="scheme-card-head">
          <div>
            <strong>${esc(s.scheme_name)}</strong>
            <span>Jal Mitra: ${esc(s.jal_mitra_name)}</span>
          </div>
          ${badge}
        </div>
      </div>`;
  }).join("") || `<div class="muted center" style="padding:12px;">No matching schemes.</div>`;
}

$("#search").addEventListener("input", render);
loadData();
