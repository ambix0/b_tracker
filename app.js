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
}).format(new Date(`${d}T00:00:00`));

const fmtShortDate = d => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata"
}).format(new Date(`${d}T00:00:00`));

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

let schemes = [];
let updates = [];
let dates = [];
let page = 1;
const PAGE_SIZE = 5;

async function api(path, options = {}) {
  const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cfg.SUPABASE_KEY,
      Authorization: `Bearer ${cfg.SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? [] : r.json();
}

function filteredSchemes() {
  const q = ($("#search").value || "").toLowerCase().trim();
  const type = $("#typeFilter").value;

  return schemes.filter(s => {
    const matchesText =
      `${s.scheme_name} ${s.person_name}`.toLowerCase().includes(q);
    const matchesType = !type || s.person_type === type;
    return matchesText && matchesType;
  });
}

function render() {
  const filtered = filteredSchemes();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, totalPages);

  const start = (page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const map = new Map(
    updates.map(x => [`${x.scheme_id}|${x.update_date}`, x.status])
  );

  $("#thead").innerHTML = `<tr>
    <th>Scheme</th>
    <th>Person</th>
    <th>Type</th>
    ${dates.map(d => `<th class="center">${esc(fmtShortDate(d))}</th>`).join("")}
  </tr>`;

  $("#tbody").innerHTML = visible.map(s => `
    <tr>
      <td><strong>${esc(s.scheme_name)}</strong></td>
      <td>${esc(s.person_name)}</td>
      <td>${esc(s.person_type)}</td>
      ${dates.map(d => {
        const v = map.get(`${s.id}|${d}`);
        return `<td class="center">${
          v === true
            ? '<span class="badge yes">✓</span>'
            : v === false
              ? '<span class="badge no">✕</span>'
              : '<span class="muted">—</span>'
        }</td>`;
      }).join("")}
    </tr>
  `).join("") || `<tr><td colspan="20" class="center muted">No matching schemes.</td></tr>`;

  $("#cards").innerHTML = visible.map(s => `
    <article class="scheme-card">
      <div class="scheme-card-head">
        <div>
          <h3>${esc(s.scheme_name)}</h3>
          <div class="person-name">${esc(s.person_name)}</div>
          <div class="person-type">${esc(s.person_type)}</div>
        </div>
      </div>
      <div class="status-list">
        ${dates.map(d => {
          const v = map.get(`${s.id}|${d}`);
          const label = d === todayISO() ? `Today (${fmtShortDate(d)})` : fmtShortDate(d);
          return `<div class="status-row">
            <span>${esc(label)}</span>
            <span class="status-text ${
              v === true ? "status-updated" : v === false ? "status-not-updated" : "status-empty"
            }">
              ${v === true ? "✓ UPDATED" : v === false ? "✕ NOT UPDATED" : "—"}
            </span>
          </div>`;
        }).join("")}
      </div>
    </article>
  `).join("") || `<div class="empty-card muted">No matching schemes.</div>`;

  $("#pagination").innerHTML = totalPages > 1 ? `
    <button class="secondary" ${page === 1 ? "disabled" : ""} data-page="${page - 1}">‹ Prev</button>
    ${Array.from({length: totalPages}, (_, i) => i + 1).map(n =>
      `<button class="${n === page ? "primary" : "secondary"} page-btn" data-page="${n}">${n}</button>`
    ).join("")}
    <button class="secondary" ${page === totalPages ? "disabled" : ""} data-page="${page + 1}">Next ›</button>
  ` : "";

  document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => {
    const n = Number(b.dataset.page);
    if (n >= 1 && n <= totalPages) {
      page = n;
      render();
      window.scrollTo({ top: document.querySelector(".table-panel").offsetTop - 12, behavior: "smooth" });
    }
  }));
}

async function load() {
  if (!cfg?.SUPABASE_URL || cfg.SUPABASE_URL.includes("PASTE_")) {
    $("#message").textContent = "Add your Supabase values to config.js first.";
    return;
  }

  [schemes, updates] = await Promise.all([
    api("schemes?select=id,scheme_name,person_type,person_name&order=scheme_name"),
    api("bfm_updates?select=scheme_id,update_date,status&order=update_date.desc")
  ]);

  dates = [...new Set(updates.map(x => x.update_date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7)
    .sort();

  const today = todayISO();
  const todays = updates.filter(x => x.update_date === today);
  const updatedCount = new Set(
    todays.filter(x => x.status).map(x => x.scheme_id)
  ).size;

  $("#today").textContent = fmtDate(today);
  $("#total").textContent = schemes.length;
  $("#updated").textContent = updatedCount;
  $("#pending").textContent = Math.max(0, schemes.length - updatedCount);
  $("#completion").textContent = schemes.length
    ? Math.round(updatedCount / schemes.length * 100) + "%"
    : "0%";

  render();
}

$("#search").addEventListener("input", () => {
  page = 1;
  render();
});

$("#typeFilter").addEventListener("change", () => {
  page = 1;
  render();
});

load().catch(e => {
  $("#message").textContent = e.message;
});
