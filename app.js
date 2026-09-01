const cfg=window.BFM_CONFIG;
const $=s=>document.querySelector(s);
const todayISO=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`};
const fmtDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(`${d}T00:00:00`));
const fmtShortDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",timeZone:"Asia/Kolkata"}).format(new Date(`${d}T00:00:00`));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let schemes=[],updates=[],dates=[],page=1;const PAGE_SIZE=5;

async function api(path,options={}){const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:cfg.SUPABASE_KEY,Authorization:`Bearer ${cfg.SUPABASE_KEY}`,"Content-Type":"application/json",Prefer:"return=representation",...(options.headers||{})}});if(!r.ok)throw new Error(await r.text());return r.status===204?[]:r.json()}

function filteredSchemes(){const q=($("#search").value||"").toLowerCase().trim();return schemes.filter(s=>`${s.scheme_name} ${s.person_name}`.toLowerCase().includes(q))}
function statusHTML(v){return v===true?'<span class="badge yes">✓</span>':v===false?'<span class="badge no">✕</span>':'<span class="badge empty">—</span>'}
function bfmBadge(v){return v==='Dysfunctional'?'<span class="bfm-badge dysfunctional">Dysfunctional</span>':'<span class="bfm-badge functional">Functional</span>'}

function render(){
 const filtered=filteredSchemes(),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages);
 const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const map=new Map(updates.map(x=>[`${x.scheme_id}|${x.update_date}`,x.status]));
 $("#thead").innerHTML=`<tr><th>Scheme</th><th>Person</th><th>Type</th><th>BFM</th>${dates.map(d=>`<th class="center">${esc(fmtShortDate(d))}</th>`).join("")}</tr>`;
 $("#tbody").innerHTML=visible.map(s=>`<tr><td><strong>${esc(s.scheme_name)}</strong></td><td>${esc(s.person_name)}</td><td>${esc(s.person_type)}</td><td>${bfmBadge(s.bfm_status)}</td>${dates.map(d=>`<td class="center">${statusHTML(map.get(`${s.id}|${d}`))}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="20" class="center muted">No matching schemes.</td></tr>`;

 $("#cards").innerHTML=visible.map((s,i)=>`<article class="scheme-card">
   <div class="scheme-card-top"><div class="scheme-number">${(page-1)*PAGE_SIZE+i+1}</div><div class="scheme-title"><h3>${esc(s.scheme_name)}</h3><div>${esc(s.person_name)} <span class="dot">·</span> ${esc(s.person_type)}</div><div class="scheme-bfm">${bfmBadge(s.bfm_status)}</div></div><span class="chevron">›</span></div>
   <div class="card-statuses">${dates.map(d=>`<div class="day-status"><span class="${d===todayISO()?"today-label":""}">${d===todayISO()?"Today":esc(fmtShortDate(d))}</span>${statusHTML(map.get(`${s.id}|${d}`))}</div>`).join("")}</div>
 </article>`).join("")||`<div class="empty-card muted">No matching schemes.</div>`;

 $("#pagination").innerHTML=pages>1?`<button class="secondary" ${page===1?"disabled":""} data-page="${page-1}">‹</button>${Array.from({length:pages},(_,i)=>i+1).map(n=>`<button class="${n===page?"primary":"secondary"}" data-page="${n}">${n}</button>`).join("")}<button class="secondary" ${page===pages?"disabled":""} data-page="${page+1}">›</button>`:"";
 document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.page);if(n>=1&&n<=pages){page=n;render();window.scrollTo({top:document.querySelector(".table-panel").offsetTop-10,behavior:"smooth"})}}));
}

async function load(){
 if(!cfg?.SUPABASE_URL||cfg.SUPABASE_URL.includes("PASTE_"))throw new Error("Add your Supabase values to config.js first.");
 [schemes,updates]=await Promise.all([api("schemes?select=id,scheme_name,person_type,person_name,bfm_status&order=scheme_name"),api("bfm_updates?select=scheme_id,update_date,status&order=update_date.desc")]);
 dates=[...new Set(updates.map(x=>x.update_date))].sort((a,b)=>b.localeCompare(a)).slice(0,7).sort();
 const today=todayISO(),functionalSchemes=schemes.filter(s=>s.bfm_status==='Functional'),functionalIds=new Set(functionalSchemes.map(s=>s.id)),todays=updates.filter(x=>x.update_date===today&&functionalIds.has(x.scheme_id)),updated=new Set(todays.filter(x=>x.status).map(x=>x.scheme_id)).size;
 $("#today").textContent=fmtDate(today);$("#total").textContent=functionalSchemes.length;$("#updated").textContent=updated;$("#pending").textContent=Math.max(0,functionalSchemes.length-updated);$("#completion").textContent=functionalSchemes.length?Math.round(updated/functionalSchemes.length*100)+"%":"0%";
 $("#lastUpdated").textContent=new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date());
 render();
}
$("#search").addEventListener("input",()=>{page=1;render()});
$("#refresh").addEventListener("click",()=>load().catch(e=>$("#message").textContent=e.message));
load().catch(e=>$("#message").textContent="Unable to load dashboard. Please try again.");
