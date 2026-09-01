const cfg=window.BFM_CONFIG;
const $=s=>document.querySelector(s);
const todayISO=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`};
const fmtDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(`${d}T00:00:00`));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token=null,refreshToken=null,schemes=[],updates=[],selectedStatus=null,editingSchemeId=null;

const SESSION_KEY="bfm_admin_session";

function saveSession(session){
  const data={
    access_token:session.access_token,
    refresh_token:session.refresh_token,
    expires_at:session.expires_at || Math.floor(Date.now()/1000)+(session.expires_in||3600)
  };
  localStorage.setItem(SESSION_KEY,JSON.stringify(data));
  token=data.access_token;
  refreshToken=data.refresh_token;
}

function clearSession(){
  localStorage.removeItem(SESSION_KEY);
  token=null;
  refreshToken=null;
}

function showAdmin(){
  $("#loginCard").hidden=true;
  $("#adminApp").hidden=false;
  $("#logout").hidden=false;
}

function showLogin(){
  $("#adminApp").hidden=true;
  $("#loginCard").hidden=false;
  $("#logout").hidden=true;
}

async function refreshAuthSession(){
  const raw=localStorage.getItem(SESSION_KEY);
  if(!raw)return false;

  let session;
  try{session=JSON.parse(raw)}catch(_){clearSession();return false}

  const now=Math.floor(Date.now()/1000);
  if(session.access_token && session.expires_at && session.expires_at > now+60){
    token=session.access_token;
    refreshToken=session.refresh_token;
    return true;
  }

  if(!session.refresh_token){
    clearSession();
    return false;
  }

  try{
    const r=await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:"POST",
      headers:{apikey:cfg.SUPABASE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if(!r.ok)throw new Error("Session expired");
    const next=await r.json();
    saveSession(next);
    return true;
  }catch(_){
    clearSession();
    return false;
  }
}

async function api(path,options={},auth=true){
  if(auth && !token)throw new Error("Not authenticated");
  const headers={
    apikey:cfg.SUPABASE_KEY,
    "Content-Type":"application/json",
    Prefer:"return=representation",
    ...(auth&&token?{Authorization:`Bearer ${token}`}:{})
    ,...(options.headers||{})
  };
  const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
  if(r.status===401 && auth){
    const ok=await refreshAuthSession();
    if(ok){
      headers.Authorization=`Bearer ${token}`;
      const retry=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
      if(!retry.ok)throw new Error(await retry.text());
      return retry.status===204?[]:retry.json();
    }
  }
  if(!r.ok)throw new Error(await r.text());
  return r.status===204?[]:r.json();
}

async function login(email,password){
  const r=await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });
  if(!r.ok)throw new Error("Login failed. Check email/password.");
  return r.json();
}

async function logoutSupabase(){
  if(!token)return;
  try{
    await fetch(`${cfg.SUPABASE_URL}/auth/v1/logout`,{
      method:"POST",
      headers:{apikey:cfg.SUPABASE_KEY,Authorization:`Bearer ${token}`}
    });
  }catch(_){}
  clearSession();
}

function resetStatus(){selectedStatus=null;document.querySelectorAll(".status-btn").forEach(x=>x.classList.remove("selected"))}
function resetSchemeForm(){editingSchemeId=null;$("#newScheme").value="";$("#newPersonName").value="";$("#newPersonType").value="Swajal Mitra";$("#newBfmStatus").value="Functional";$("#schemeSubmit").textContent="＋ Add Scheme";$("#cancelEdit").hidden=true}
function updatePersonFields(){const s=schemes.find(x=>String(x.id)===$("#scheme").value);$("#personName").textContent=s?.person_name||"—";$("#personType").textContent=s?.person_type||"—";$("#bfmStatus").textContent=s?.bfm_status||"—"}
function loadExistingStatus(){const id=Number($("#scheme").value),date=$("#date").value;resetStatus();if(!id||!date)return;const x=updates.find(v=>Number(v.scheme_id)===id&&v.update_date===date);if(x){selectedStatus=x.status;document.querySelectorAll(".status-btn").forEach(b=>b.classList.toggle("selected",b.dataset.status===String(x.status)));$("#saveMsg").textContent="Existing status loaded. You can change it."}else $("#saveMsg").textContent=""}

async function refresh(){
 schemes=await api("schemes?select=id,scheme_name,person_type,person_name,bfm_status&order=scheme_name");
 updates=await api("bfm_updates?select=scheme_id,update_date,status,created_at&order=created_at.desc&limit=50");
 $("#scheme").innerHTML=schemes.map(s=>`<option value="${s.id}">${esc(s.scheme_name)}</option>`).join("");
 if(schemes.length)updatePersonFields();else{$("#personName").textContent="—";$("#personType").textContent="—";$("#bfmStatus").textContent="—"}
 loadExistingStatus();
 const today=todayISO(),functionalSchemes=schemes.filter(s=>s.bfm_status==='Functional'),functionalIds=new Set(functionalSchemes.map(s=>s.id)),todays=updates.filter(x=>x.update_date===today&&functionalIds.has(x.scheme_id)),u=new Set(todays.filter(x=>x.status).map(x=>x.scheme_id)).size;
 $("#adminToday").textContent=fmtDate(today);$("#aTotal").textContent=functionalSchemes.length;$("#aUpdated").textContent=u;$("#aPending").textContent=Math.max(0,functionalSchemes.length-u);$("#aCompletion").textContent=functionalSchemes.length?Math.round(u/functionalSchemes.length*100)+"%":"0%";
 $("#recent").innerHTML=updates.map(x=>{const s=schemes.find(z=>z.id===x.scheme_id);return `<tr><td>${esc(s?.scheme_name||"Deleted scheme")}</td><td>${esc(s?.person_name||"")}</td><td>${esc(s?.person_type||"")}</td><td>${fmtDate(x.update_date)}</td><td>${x.status?'<span class="badge yes">✓</span>':'<span class="badge no">✕</span>'}</td></tr>`}).join("")||`<tr><td colspan="5" class="muted">No updates yet.</td></tr>`;
 $("#recentCards").innerHTML=updates.slice(0,10).map(x=>{const s=schemes.find(z=>z.id===x.scheme_id);return `<div class="mobile-record"><span class="record-status ${x.status?"r-yes":"r-no"}">${x.status?"✓":"✕"}</span><div><strong>${esc(s?.scheme_name||"Deleted scheme")}</strong><small>${esc(s?.person_name||"")} · ${esc(s?.person_type||"")}</small></div><span class="record-date">${fmtDate(x.update_date)}</span></div>`}).join("")||`<div class="muted">No updates yet.</div>`;
 $("#schemesList").innerHTML=schemes.map(s=>`<tr><td>${esc(s.scheme_name)}</td><td>${esc(s.person_type)}</td><td>${esc(s.person_name)}</td><td>${esc(s.bfm_status)}</td><td class="actions"><button type="button" class="secondary small-btn edit-scheme" data-id="${s.id}">Edit</button><button type="button" class="danger small-btn delete-scheme" data-id="${s.id}">Delete</button></td></tr>`).join("");
 $("#schemeCards").innerHTML=schemes.map(s=>`<div class="mobile-record scheme-record"><div><strong>${esc(s.scheme_name)}</strong><small>${esc(s.person_name)} · ${esc(s.person_type)} · ${esc(s.bfm_status)}</small></div><div class="record-actions"><button type="button" class="secondary small-btn edit-scheme" data-id="${s.id}">Edit</button><button type="button" class="danger small-btn delete-scheme" data-id="${s.id}">Delete</button></div></div>`).join("");
 document.querySelectorAll(".edit-scheme").forEach(b=>b.addEventListener("click",()=>startEdit(Number(b.dataset.id))));
 document.querySelectorAll(".delete-scheme").forEach(b=>b.addEventListener("click",()=>deleteScheme(Number(b.dataset.id))));
}
function startEdit(id){const s=schemes.find(x=>x.id===id);if(!s)return;editingSchemeId=id;$("#newScheme").value=s.scheme_name;$("#newPersonType").value=s.person_type;$("#newPersonName").value=s.person_name;$("#newBfmStatus").value=s.bfm_status||"Functional";$("#schemeSubmit").textContent="Save Changes";$("#cancelEdit").hidden=false;$("#schemeMsg").textContent="Editing selected scheme.";$("#newScheme").focus()}
async function deleteScheme(id){const s=schemes.find(x=>x.id===id);if(!s)return;if(!confirm(`Delete "${s.scheme_name}"?\n\nExisting BFM records may prevent deletion.`))return;try{await api(`schemes?id=eq.${id}`,{method:"DELETE"});$("#schemeMsg").textContent="Scheme deleted.";if(editingSchemeId===id)resetSchemeForm();await refresh()}catch(e){$("#schemeMsg").textContent="Could not delete. Existing BFM records may be linked to this scheme."}}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("#loginMsg").textContent="";
  try{
    const x=await login($("#email").value.trim(),$("#password").value);
    saveSession(x);
    showAdmin();
    $("#date").value=todayISO();
    resetStatus();
    await refresh();
  }catch(err){
    clearSession();
    showLogin();
    $("#loginMsg").textContent=err.message;
  }
});

$("#logout").addEventListener("click",async()=>{
  await logoutSupabase();
  $("#password").value="";
  resetStatus();
  showLogin();
});

(async function restoreSession(){
  const ok=await refreshAuthSession();
  if(!ok){
    showLogin();
    return;
  }
  showAdmin();
  $("#date").value=todayISO();
  try{
    await refresh();
  }catch(err){
    clearSession();
    showLogin();
    $("#loginMsg").textContent="Your session could not be restored. Please log in again.";
  }
})();
document.querySelectorAll(".status-btn").forEach(b=>b.addEventListener("click",()=>{selectedStatus=b.dataset.status==="true";document.querySelectorAll(".status-btn").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")}));
$("#scheme").addEventListener("change",()=>{updatePersonFields();loadExistingStatus()});
$("#date").addEventListener("change",loadExistingStatus);
$("#updateForm").addEventListener("submit",async e=>{e.preventDefault();if(selectedStatus===null){$("#saveMsg").textContent="Select ✓ or ✕ first.";return}try{await api("bfm_updates?on_conflict=scheme_id,update_date",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({scheme_id:Number($("#scheme").value),update_date:$("#date").value,status:selectedStatus})});$("#saveMsg").textContent="Saved successfully.";resetStatus();await refresh()}catch(err){$("#saveMsg").textContent="Save failed: "+err.message}});
$("#schemeForm").addEventListener("submit",async e=>{e.preventDefault();const name=$("#newScheme").value.trim(),type=$("#newPersonType").value,person=$("#newPersonName").value.trim(),bfmStatus=$("#newBfmStatus").value;if(!name||!person)return;try{if(editingSchemeId){await api(`schemes?id=eq.${editingSchemeId}`,{method:"PATCH",body:JSON.stringify({scheme_name:name,person_type:type,person_name:person,bfm_status:bfmStatus})});$("#schemeMsg").textContent="Scheme updated."}else{await api("schemes",{method:"POST",body:JSON.stringify({scheme_name:name,person_type:type,person_name:person,bfm_status:bfmStatus})});$("#schemeMsg").textContent="Scheme added."}resetSchemeForm();await refresh()}catch(err){$("#schemeMsg").textContent="Could not save: "+err.message}});
$("#cancelEdit").addEventListener("click",()=>{resetSchemeForm();$("#schemeMsg").textContent=""});
$("#refresh").addEventListener("click",()=>refresh().catch(e=>$("#saveMsg").textContent="Refresh failed: "+e.message));
$("#addSchemeTop").addEventListener("click",()=>{resetSchemeForm();$("#schemeMsg").textContent="";$("#newScheme").focus();window.scrollTo({top:document.querySelector(".scheme-form").offsetTop-20,behavior:"smooth"})});
