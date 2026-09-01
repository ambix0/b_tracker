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
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const SESSION_KEY = "bfm_admin_session";
let token = null, refreshToken = null, schemes = [], selectedStatus = null;

async function api(path, options = {}, auth = true) {
  const headers = {
    apikey: cfg.SUPABASE_KEY,
    "Content-Type": "application/json",
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    Prefer: "return=representation",
    ...(options.headers || {})
  };
  const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? [] : r.json();
}

function saveSession(x) {
  const expiresAt = Math.floor(Date.now() / 1000) + (x.expires_in || 3600);
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    access_token: x.access_token,
    refresh_token: x.refresh_token,
    expires_at: expiresAt
  }));
  token = x.access_token;
  refreshToken = x.refresh_token;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  token = null;
  refreshToken = null;
}

async function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    if (!s.refresh_token) return false;
    if (s.expires_at > Date.now() / 1000 + 60) {
      token = s.access_token;
      refreshToken = s.refresh_token;
      return true;
    }
    const r = await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: cfg.SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (!r.ok) throw new Error("Session expired");
    const x = await r.json();
    saveSession(x);
    return true;
  } catch (e) {
    clearSession();
    return false;
  }
}

function showApp() {
  $("#loginCard").hidden = true;
  $("#adminApp").hidden = false;
}

function showLogin() {
  $("#adminApp").hidden = true;
  $("#loginCard").hidden = false;
}

async function login(email, password) {
  const r = await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) throw new Error("Login failed. Check email/password.");
  return r.json();
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#loginMsg").textContent = "";
  try {
    const x = await login($("#email").value, $("#password").value);
    saveSession(x);
    showApp();
    $("#date").value = todayISO();
    await refresh();
  } catch (err) {
    $("#loginMsg").textContent = err.message;
  }
});

$("#logout").addEventListener("click", () => {
  clearSession();
  showLogin();
});

document.querySelectorAll(".status-btn").forEach(b => {
  b.addEventListener("click", () => {
    selectedStatus = b.dataset.status === "true";
    document.querySelectorAll(".status-btn").forEach(x => x.classList.remove("selected"));
    b.classList.add("selected");
  });
});

$("#scheme").addEventListener("change", () => {
  const s = schemes.find(x => String(x.id) === $("#scheme").value);
  $("#mitra").value = s?.jal_mitra_name || "";
});

$("#updateForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (selectedStatus === null) {
    $("#saveMsg").textContent = "Please select ✓ UPDATED or ✕ NOT UPDATED.";
    return;
  }
  try {
    const row = {
      scheme_id: Number($("#scheme").value),
      update_date: $("#date").value,
      status: selectedStatus
    };
    await api("bfm_updates?on_conflict=scheme_id,update_date", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row)
    });
    $("#saveMsg").textContent = "Saved successfully.";
    await refresh();
  } catch (err) {
    $("#saveMsg").textContent = "Save failed: " + err.message;
  }
});

$("#schemeForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("schemes", {
      method: "POST",
      body: JSON.stringify({
        scheme_name: $("#newScheme").value.trim(),
        jal_mitra_name: $("#newMitra").value.trim()
      })
    });
    $("#newScheme").value = "";
    $("#newMitra").value = "";
    $("#schemeMsg").textContent = "Scheme added successfully.";
    await refresh();
  } catch (err) {
    $("#schemeMsg").textContent = "Could not add: " + err.message;
  }
});

$("#refresh").addEventListener("click", () => refresh());

async function refresh() {
  schemes = await api("schemes?select=id,scheme_name,jal_mitra_name&order=scheme_name");
  const updates = await api("bfm_updates?select=scheme_id,update_date,status,created_at&order=created_at.desc&limit=30");

  $("#scheme").innerHTML = schemes.map(s => `<option value="${s.id}">${esc(s.scheme_name)}</option>`).join("");
  if (schemes.length && !$("#mitra").value) {
    $("#mitra").value = schemes[0].jal_mitra_name;
  }

  const today = todayISO();
  const todays = updates.filter(x => x.update_date === today);
  const u = todays.filter(x => x.status).length;

  $("#aTotal").textContent = schemes.length;
  $("#aUpdated").textContent = u;
  $("#aPending").textContent = Math.max(0, schemes.length - u);
  $("#aCompletion").textContent = schemes.length ? Math.round(u / schemes.length * 100) + "%" : "0%";

  $("#recentUpdatesList").innerHTML = updates.map(x => {
    const s = schemes.find(z => z.id === x.scheme_id);
    return `
      <div class="admin-card">
        <div class="admin-card-info">
          <strong>${esc(s?.scheme_name || "Unknown Scheme")}</strong>
          <span>${esc(s?.jal_mitra_name || "—")} · ${fmtDate(x.update_date)}</span>
        </div>
        ${x.status ? '<span class="badge yes">✓</span>' : '<span class="badge no">✕</span>'}
      </div>
    `;
  }).join("") || `<div class="muted center" style="padding: 12px;">No updates recorded yet.</div>`;

  $("#schemesListMobile").innerHTML = schemes.map(s => `
    <div class="admin-card">
      <div class="admin-card-info">
        <strong>${esc(s.scheme_name)}</strong>
        <span>Jal Mitra: ${esc(s.jal_mitra_name)}</span>
      </div>
    </div>
  `).join("");
}

(async function initSession() {
  if (cfg.SUPABASE_KEY.includes("REPLACE_")) return;
  if (await restoreSession()) {
    showApp();
    $("#date").value = todayISO();
    try {
      await refresh();
    } catch (e) {
      showLogin();
    }
  }
})();
