const cfg = window.BFM_CONFIG;
const $ = s => document.querySelector(s);
const fmtDate = d => new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d);
const todayISO = () => {
  const p = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const m=Object.fromEntries(p.map(x=>[x.type,x.value])); return `${m.year}-${m.month}-${m.day}`;
};
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path, options={}){
  const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:cfg.SUPABASE_KEY,Authorization:`Bearer ${cfg.SUPABASE_KEY}`,"Content-Type":"application/json",Prefer:"return=representation",...(options.headers||{})}
  });
  if(!r.ok) throw new Error(await r.text());
  return r.status===204?[]:r.json();
}
async function load(){
  if(cfg.SUPABASE_URL.includes("PASTE_")) { $("#message").textContent="Add your Supabase values to config.js first."; return; }
  const schemes=await api("schemes?select=id,scheme_name,jal_mitra_name&order=scheme_name");
  const updates=await api("bfm_updates?select=scheme_id,update_date,status&order=update_date.desc");
  const dates=[...new Set(updates.map(x=>x.update_date))].slice(0,7).sort();
  $("#today").textContent=fmtDate(new Date(`${todayISO()}T00:00:00`));
  $("#total").textContent=schemes.length;
  const today=todayISO(), todays=updates.filter(x=>x.update_date===today);
  const u=todays.filter(x=>x.status).length; $("#updated").textContent=u; $("#pending").textContent=Math.max(0,schemes.length-u); $("#completion").textContent=schemes.length?Math.round(u/schemes.length*100)+"%":"0%";
  const head=`<tr><th>Scheme</th><th>Jal Mitra</th>${dates.map(d=>`<th class="center">${esc(new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",timeZone:"Asia/Kolkata"}).format(new Date(d+"T00:00:00")))}</th>`).join("")}</tr>`;
  $("#thead").innerHTML=head;
  const q=($("#search").value||"").toLowerCase().trim();
  const map=new Map(updates.map(x=>[`${x.scheme_id}|${x.update_date}`,x.status]));
  const filtered=schemes.filter(s=>`${s.scheme_name} ${s.jal_mitra_name}`.toLowerCase().includes(q));
  $("#tbody").innerHTML=filtered.map(s=>`<tr><td><strong>${esc(s.scheme_name)}</strong></td><td>${esc(s.jal_mitra_name)}</td>${dates.map(d=>{const v=map.get(`${s.id}|${d}`);return `<td class="center">${v===true?'<span class="badge yes">✓</span>':v===false?'<span class="badge no">✕</span>':'<span class="muted">—</span>'}</td>`}).join("")}</tr>`).join("") || `<tr><td colspan="20" class="center muted">No matching schemes.</td></tr>`;
  $("#mobileCards").innerHTML=filtered.map(s=>`<article class="scheme-card"><div class="scheme-card-head"><div><strong>${esc(s.scheme_name)}</strong><span>${esc(s.jal_mitra_name)}</span></div><span class="mitra-label">Jal Mitra</span></div><div class="day-grid">${dates.map(d=>{const v=map.get(`${s.id}|${d}`);const label=new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",timeZone:"Asia/Kolkata"}).format(new Date(d+"T00:00:00"));return `<div class="day-item"><span>${esc(label)}</span>${v===true?'<span class="badge yes">✓</span>':v===false?'<span class="badge no">✕</span>':'<span class="badge empty">—</span>'}</div>`}).join("")}</div></article>`).join("") || `<div class="panel center muted">No matching schemes.</div>`;
}
$("#search").addEventListener("input",()=>load().catch(e=>$("#message").textContent=e.message));
load().catch(e=>$("#message").textContent=e.message);