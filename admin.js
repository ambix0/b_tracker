const cfg=window.BFM_CONFIG;
const $=s=>document.querySelector(s);
const todayISO=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`};
const fmtDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(d+"T00:00:00"));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token=null, schemes=[], selectedStatus=null;
async function api(path,options={},auth=true){
 const headers={apikey:cfg.SUPABASE_KEY,"Content-Type":"application/json",...(auth&&token?{Authorization:`Bearer ${token}`}:{}),Prefer:"return=representation",...(options.headers||{})};
 const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
 if(!r.ok) throw new Error(await r.text()); return r.status===204?[]:r.json();
}
async function login(email,password){
 const r=await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:cfg.SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 if(!r.ok) throw new Error("Login failed. Check email/password.");
 return r.json();
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginMsg").textContent="";try{const x=await login($("#email").value,$("#password").value);token=x.access_token;$("#loginCard").hidden=true;$("#adminApp").hidden=false;$("#date").value=todayISO();await refresh();}catch(err){$("#loginMsg").textContent=err.message;}});
$("#logout").addEventListener("click",()=>{token=null;$("#adminApp").hidden=true;$("#loginCard").hidden=false;});
document.querySelectorAll(".status-btn").forEach(b=>b.addEventListener("click",()=>{selectedStatus=b.dataset.status==="true";document.querySelectorAll(".status-btn").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");}));
$("#scheme").addEventListener("change",()=>{const s=schemes.find(x=>String(x.id)===$("#scheme").value);$("#mitra").value=s?.jal_mitra_name||"";});
$("#updateForm").addEventListener("submit",async e=>{e.preventDefault();if(selectedStatus===null){$("#saveMsg").textContent="Select ✓ or ✕ first.";return;}try{const row={scheme_id:Number($("#scheme").value),update_date:$("#date").value,status:selectedStatus};await api("bfm_updates?on_conflict=scheme_id,update_date",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)});$("#saveMsg").textContent="Saved successfully.";await refresh();}catch(err){$("#saveMsg").textContent="Save failed: "+err.message;}});
$("#schemeForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("schemes",{method:"POST",body:JSON.stringify({scheme_name:$("#newScheme").value.trim(),jal_mitra_name:$("#newMitra").value.trim()})});$("#newScheme").value="";$("#newMitra").value="";$("#schemeMsg").textContent="Scheme added.";await refresh();}catch(err){$("#schemeMsg").textContent="Could not add: "+err.message;}});
$("#refresh").addEventListener("click",()=>refresh());
async function refresh(){
 schemes=await api("schemes?select=id,scheme_name,jal_mitra_name&order=scheme_name");
 const updates=await api("bfm_updates?select=scheme_id,update_date,status,created_at&order=created_at.desc&limit=50");
 $("#scheme").innerHTML=schemes.map(s=>`<option value="${s.id}">${esc(s.scheme_name)}</option>`).join("");
 if(schemes.length) $("#mitra").value=schemes[0].jal_mitra_name;
 const today=todayISO(),todays=updates.filter(x=>x.update_date===today),u=todays.filter(x=>x.status).length;
 $("#aTotal").textContent=schemes.length;$("#aUpdated").textContent=u;$("#aPending").textContent=Math.max(0,schemes.length-u);$("#aCompletion").textContent=schemes.length?Math.round(u/schemes.length*100)+"%":"0%";
 $("#recent").innerHTML=updates.map(x=>{const s=schemes.find(z=>z.id===x.scheme_id);return `<tr><td>${esc(s?.scheme_name||"")}</td><td>${esc(s?.jal_mitra_name||"")}</td><td>${fmtDate(x.update_date)}</td><td>${x.status?'<span class="badge yes">✓</span>':'<span class="badge no">✕</span>'}</td></tr>`}).join("")||`<tr><td colspan="4" class="muted">No updates yet.</td></tr>`;
 $("#schemesList").innerHTML=schemes.map(s=>`<tr><td>${esc(s.scheme_name)}</td><td>${esc(s.jal_mitra_name)}</td></tr>`).join("");
}