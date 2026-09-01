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

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

let token = null;
let schemes = [];
let selectedStatus = null;
let editingSchemeId = null;

async function api(path, options = {}, auth = true) {
  const headers = {
    apikey: cfg.SUPABASE_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers
  });

  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? [] : r.json();
}

async function login(email, password) {
  const r = await fetch(
    `${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: cfg.SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }
  );

  if (!r.ok) throw new Error("Login failed. Check email/password.");
  return r.json();
}

async function logoutSupabase() {
  if (!token) return;
  try {
    await fetch(`${cfg.SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: cfg.SUPABASE_KEY,
        Authorization: `Bearer ${token}`
      }
    });
  } catch (_) {}
}

function resetStatus() {
  selectedStatus = null;
  document.querySelectorAll(".status-btn").forEach(x => x.classList.remove("selected"));
}

function resetSchemeForm() {
  editingSchemeId = null;
  $("#newScheme").value = "";
  $("#newPersonName").value = "";
  $("#newPersonType").value = "Swajal Mitra";
  $("#schemeSubmit").textContent = "+ Add Scheme";
  $("#cancelEdit").hidden = true;
}

function updatePersonFields() {
  const s = schemes.find(x => String(x.id) === $("#scheme").value);
  $("#personType").value = s?.person_type || "";
  $("#personName").value = s?.person_name || "";
}

async function refresh() {
  schemes = await api(
    "schemes?select=id,scheme_name,person_type,person_name&order=scheme_name"
  );

  const updates = await api(
    "bfm_updates?select=scheme_id,update_date,status,created_at&order=created_at.desc&limit=50"
  );

  $("#scheme").innerHTML = schemes.map(s =>
    `<option value="${s.id}">${esc(s.scheme_name)}</option>`
  ).join("");

  if (schemes.length) {
    updatePersonFields();
  } else {
    $("#personType").value = "";
    $("#personName").value = "";
  }

  const today = todayISO();
  const todays = updates.filter(x => x.update_date === today);
  const updatedIds = new Set(todays.filter(x => x.status).map(x => x.scheme_id));
  const updatedCount = updatedIds.size;

  $("#aTotal").textContent = schemes.length;
  $("#aUpdated").textContent = updatedCount;
  $("#aPending").textContent = Math.max(0, schemes.length - updatedCount);
  $("#aCompletion").textContent = schemes.length
    ? Math.round(updatedCount / schemes.length * 100) + "%"
    : "0%";

  $("#recent").innerHTML = updates.map(x => {
    const s = schemes.find(z => z.id === x.scheme_id);
    return `<tr>
      <td>${esc(s?.scheme_name || "Deleted scheme")}</td>
      <td>${esc(s?.person_name || "")}</td>
      <td>${esc(s?.person_type || "")}</td>
      <td>${fmtDate(x.update_date)}</td>
      <td>${x.status
        ? '<span class="badge yes">✓</span>'
        : '<span class="badge no">✕</span>'}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">No updates yet.</td></tr>`;

  $("#schemesList").innerHTML = schemes.map(s => `
    <tr>
      <td>${esc(s.scheme_name)}</td>
      <td>${esc(s.person_type)}</td>
      <td>${esc(s.person_name)}</td>
      <td class="actions">
        <button type="button" class="secondary small-btn edit-scheme" data-id="${s.id}">Edit</button>
        <button type="button" class="danger small-btn delete-scheme" data-id="${s.id}">Delete</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">No schemes yet.</td></tr>`;

  document.querySelectorAll(".edit-scheme").forEach(b =>
    b.addEventListener("click", () => startEdit(Number(b.dataset.id)))
  );

  document.querySelectorAll(".delete-scheme").forEach(b =>
    b.addEventListener("click", () => deleteScheme(Number(b.dataset.id)))
  );
}

function startEdit(id) {
  const s = schemes.find(x => x.id === id);
  if (!s) return;

  editingSchemeId = id;
  $("#newScheme").value = s.scheme_name;
  $("#newPersonType").value = s.person_type;
  $("#newPersonName").value = s.person_name;
  $("#schemeSubmit").textContent = "Save Changes";
  $("#cancelEdit").hidden = false;
  $("#schemeMsg").textContent = "Editing selected scheme.";
  $("#newScheme").focus();
}

async function deleteScheme(id) {
  const s = schemes.find(x => x.id === id);
  if (!s) return;

  const ok = confirm(
    `Delete "${s.scheme_name}"?\n\nThis may fail if existing BFM updates are linked to the scheme.`
  );
  if (!ok) return;

  $("#schemeMsg").textContent = "Deleting…";

  try {
    await api(`schemes?id=eq.${id}`, { method: "DELETE" });
    $("#schemeMsg").textContent = "Scheme deleted.";
    if (editingSchemeId === id) resetSchemeForm();
    await refresh();
  } catch (err) {
    $("#schemeMsg").textContent =
      "Could not delete. Existing BFM records may be linked to this scheme.";
  }
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#loginMsg").textContent = "";

  try {
    const x = await login($("#email").value.trim(), $("#password").value);
    token = x.access_token;
    $("#loginCard").hidden = true;
    $("#adminApp").hidden = false;
    $("#date").value = todayISO();
    resetStatus();
    await refresh();
  } catch (err) {
    $("#loginMsg").textContent = err.message;
  }
});

$("#logout").addEventListener("click", async () => {
  await logoutSupabase();
  token = null;
  $("#adminApp").hidden = true;
  $("#loginCard").hidden = false;
  $("#password").value = "";
  resetStatus();
});

document.querySelectorAll(".status-btn").forEach(b => {
  b.addEventListener("click", () => {
    selectedStatus = b.dataset.status === "true";
    document.querySelectorAll(".status-btn").forEach(x => x.classList.remove("selected"));
    b.classList.add("selected");
  });
});

$("#scheme").addEventListener("change", updatePersonFields);

$("#updateForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (selectedStatus === null) {
    $("#saveMsg").textContent = "Select ✓ or ✕ first.";
    return;
  }

  if (!$("#scheme").value) {
    $("#saveMsg").textContent = "Add a scheme first.";
    return;
  }

  try {
    const row = {
      scheme_id: Number($("#scheme").value),
      update_date: $("#date").value,
      status: selectedStatus
    };

    await api(
      "bfm_updates?on_conflict=scheme_id,update_date",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(row)
      }
    );

    $("#saveMsg").textContent = "Saved successfully.";
    resetStatus();
    await refresh();
  } catch (err) {
    $("#saveMsg").textContent = "Save failed: " + err.message;
  }
});

$("#schemeForm").addEventListener("submit", async e => {
  e.preventDefault();

  const schemeName = $("#newScheme").value.trim();
  const personType = $("#newPersonType").value;
  const personName = $("#newPersonName").value.trim();

  if (!schemeName || !personName) return;

  try {
    if (editingSchemeId) {
      await api(`schemes?id=eq.${editingSchemeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheme_name: schemeName,
          person_type: personType,
          person_name: personName
        })
      });
      $("#schemeMsg").textContent = "Scheme updated.";
    } else {
      const duplicate = schemes.some(
        s => s.scheme_name.trim().toLowerCase() === schemeName.toLowerCase()
      );
      if (duplicate) {
        $("#schemeMsg").textContent = "A scheme with this name already exists.";
        return;
      }

      await api("schemes", {
        method: "POST",
        body: JSON.stringify({
          scheme_name: schemeName,
          person_type: personType,
          person_name: personName
        })
      });
      $("#schemeMsg").textContent = "Scheme added.";
    }

    resetSchemeForm();
    await refresh();
  } catch (err) {
    $("#schemeMsg").textContent = "Could not save: " + err.message;
  }
});

$("#cancelEdit").addEventListener("click", () => {
  resetSchemeForm();
  $("#schemeMsg").textContent = "";
});

$("#refresh").addEventListener("click", () => {
  refresh().catch(err => {
    $("#saveMsg").textContent = "Refresh failed: " + err.message;
  });
});
