const cfg=window.BFM_CONFIG;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const INDIA_TZ="Asia/Kolkata";
const PAGE_SIZE=5;
const todayISO=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:INDIA_TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`};
const fmtDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:INDIA_TZ}).format(new Date(`${d}T00:00:00`));
const fmtShortDate=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",timeZone:INDIA_TZ}).format(new Date(`${d}T00:00:00`));
const monthLabel=ym=>{const [y,m]=ym.split("-").map(Number);return new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:INDIA_TZ}).format(new Date(Date.UTC(y,m-1,1)))};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthDays=(ym)=>{const [y,m]=ym.split("-").map(Number),n=new Date(Date.UTC(y,m,0)).getUTCDate();return Array.from({length:n},(_,i)=>`${y}-${String(m).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`)};
let schemes=[],updates=[],availableMonths=[],selectedMonth="",selectedFilter="all",page=1,search="",sort="name",statusFilter="all",lastFocusedScheme=null;

async function api(path,options={}){const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:cfg.SUPABASE_KEY,Authorization:`Bearer ${cfg.SUPABASE_KEY}`,"Content-Type":"application/json",Prefer:"return=representation",...(options.headers||{})}});if(!r.ok)throw new Error(await r.text());return r.status===204?[]:r.json()}
function currentMonth(){return todayISO().slice(0,7)}
function monthUpdatesFor(ym){return updates.filter(x=>x.update_date?.startsWith(ym))}
function latestUpdate(s){const rows=updates.filter(x=>Number(x.scheme_id)===Number(s.id)&&x.status);return rows.length?rows.map(x=>x.update_date).sort().at(-1):null}
function statusHTML(v){return v===true?'<span class="badge yes">✓</span>':v===false?'<span class="badge no">✕</span>':'<span class="badge empty">—</span>'}
function bfmBadge(v){return v==='Dysfunctional'?'<span class="bfm-badge dysfunctional">Dysfunctional</span>':'<span class="bfm-badge functional">Functional</span>'}
function getSelectedDate(){const t=todayISO();return t.startsWith(selectedMonth)?t:monthDays(selectedMonth).at(-1)}
function successfulIdsForDate(date){return new Set(updates.filter(x=>x.update_date===date&&x.status).map(x=>Number(x.scheme_id)))}
function successfulIdsForMonth(){return new Set(monthUpdatesFor(selectedMonth).filter(x=>x.status).map(x=>Number(x.scheme_id)))}
function monthlyCount(s){return new Set(monthUpdatesFor(selectedMonth).filter(x=>Number(x.scheme_id)===Number(s.id)&&x.status).map(x=>x.update_date)).size}
function filteredSchemes(){
 const date=getSelectedDate(),todayIds=successfulIdsForDate(date),monthIds=successfulIdsForMonth();
 let list=schemes.filter(s=>`${s.scheme_name} ${s.person_name}`.toLowerCase().includes(search));
 if(statusFilter!=="all")list=list.filter(s=>s.bfm_status.toLowerCase()===statusFilter);
 if(selectedFilter==="updated")list=list.filter(s=>s.bfm_status==="Functional"&&todayIds.has(Number(s.id)));
 if(selectedFilter==="pending")list=list.filter(s=>s.bfm_status==="Functional"&&!todayIds.has(Number(s.id)));
 if(selectedFilter==="functional")list=list.filter(s=>s.bfm_status==="Functional");
 if(selectedFilter==="dysfunctional")list=list.filter(s=>s.bfm_status==="Dysfunctional");
 if(selectedFilter==="month")list=list.filter(s=>monthIds.has(Number(s.id)));
 const latest=s=>latestUpdate(s)||"0000-00-00";
 list.sort((a,b)=>sort==="name"?a.scheme_name.localeCompare(b.scheme_name):sort==="name-desc"?b.scheme_name.localeCompare(a.scheme_name):sort==="bfm"?Number(b.bfm_status==="Functional")-Number(a.bfm_status==="Functional")||a.scheme_name.localeCompare(b.scheme_name):sort==="bfm-desc"?Number(b.bfm_status==="Dysfunctional")-Number(a.bfm_status==="Dysfunctional")||a.scheme_name.localeCompare(b.scheme_name):sort==="updated-desc"?latest(b).localeCompare(latest(a))||a.scheme_name.localeCompare(b.scheme_name):latest(a).localeCompare(latest(b))||a.scheme_name.localeCompare(b.scheme_name));
 return list;
}
function render(){
 const date=getSelectedDate(),todayIds=successfulIdsForDate(date),filtered=filteredSchemes(),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages);const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);const map=new Map(updates.filter(x=>x.update_date===date).map(x=>[Number(x.scheme_id),x.status]));
 const monthMode=selectedFilter==="month";
 $("#listTitle").textContent=selectedFilter==="all"?"All schemes":selectedFilter==="updated"?"Updated schemes":selectedFilter==="pending"?"Pending schemes":selectedFilter==="functional"?"Functional schemes":selectedFilter==="dysfunctional"?"Dysfunctional schemes":"Schemes updated this month";
 $("#resultSummary").textContent=`Showing ${filtered.length} of ${schemes.length} schemes · ${monthMode?monthLabel(selectedMonth):fmtDate(date)}`;
 $("#thead").innerHTML=`<tr><th>Scheme</th><th>Person</th><th>Type</th><th>BFM</th><th>Selected date</th><th>Month updates</th><th>Last update</th></tr>`;
 $("#tbody").innerHTML=visible.map(s=>`<tr class="scheme-row" data-scheme-id="${s.id}"><td><button class="table-link" data-open-scheme="${s.id}" type="button">${esc(s.scheme_name)}</button></td><td>${esc(s.person_name)}</td><td>${esc(s.person_type)}</td><td>${bfmBadge(s.bfm_status)}</td><td class="center">${statusHTML(map.get(Number(s.id)))}</td><td class="center">${monthlyCount(s)}</td><td>${latestUpdate(s)?fmtDate(latestUpdate(s)):"—"}</td></tr>`).join("")||`<tr><td colspan="7" class="center muted">No matching schemes.</td></tr>`;
 const mdays=monthDays(selectedMonth);
 $("#cards").innerHTML=visible.map((s,i)=>`<article class="scheme-card"><button class="scheme-card-main" data-open-scheme="${s.id}" type="button"><div class="scheme-card-top"><div class="scheme-number">${(page-1)*PAGE_SIZE+i+1}</div><div class="scheme-title"><h3>${esc(s.scheme_name)}</h3><div>${esc(s.person_name)} <span class="dot">·</span> ${esc(s.person_type)}</div><div class="scheme-bfm">${bfmBadge(s.bfm_status)}</div></div><span class="chevron">›</span></div></button><div class="mobile-summary"><div><span>Selected date</span>${statusHTML(map.get(Number(s.id)))}</div><div><span>Month updates</span><strong>${monthlyCount(s)} / ${mdays.length}</strong></div><div><span>Last update</span><strong>${latestUpdate(s)?fmtShortDate(latestUpdate(s)):"—"}</strong></div></div></article>`).join("")||`<div class="empty-card muted">No matching schemes.</div>`;
 $("#pagination").innerHTML=pages>1?`<button class="secondary" ${page===1?"disabled":""} data-page="${page-1}" type="button">‹</button>${Array.from({length:pages},(_,i)=>i+1).map(n=>`<button class="${n===page?"primary":"secondary"}" data-page="${n}" type="button">${n}</button>`).join("")}<button class="secondary" ${page===pages?"disabled":""} data-page="${page+1}" type="button">›</button>`:"";
 $$("[data-page]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.page);if(n>=1&&n<=pages){page=n;render();scrollToTable()}}));
 $$('[data-open-scheme]').forEach(b=>b.addEventListener('click',()=>openScheme(Number(b.dataset.openScheme))));
}
function renderStats(){
 const date=getSelectedDate(),functionalSchemes=schemes.filter(s=>s.bfm_status==="Functional"),functional=functionalSchemes.length,dysfunctional=schemes.filter(s=>s.bfm_status==="Dysfunctional").length,ids=successfulIdsForDate(date),updated=functionalSchemes.filter(s=>ids.has(Number(s.id))).length,total=functional,pending=Math.max(0,total-updated),functionalIds=new Set(functionalSchemes.map(s=>Number(s.id))),monthSuccess=Array.from(successfulIdsForMonth()).filter(id=>functionalIds.has(id)).length,days=monthDays(selectedMonth).length;
 $("#total").textContent=total;$("#updated").textContent=updated;$("#pending").textContent=pending;$("#completion").textContent=total?Math.round(updated/total*100)+"%":"0%";$("#functionalCount").textContent=functional;$("#dysfunctionalCount").textContent=dysfunctional;$("#monthUpdates").textContent=monthSuccess;$("#monthDays").textContent=`schemes with ≥1 update in ${monthLabel(selectedMonth)}`;$("#updatedLabel").textContent=fmtShortDate(date);$("#pendingLabel").textContent=fmtShortDate(date);
 $$(".stat-button,.mini-stat").forEach(b=>b.classList.toggle("active",b.dataset.filter===selectedFilter));
}
function renderMonthlyOverview(){
 const months=availableMonths.length?availableMonths:[currentMonth()];
 $("#monthlyOverview").innerHTML=months.slice(0,12).map(ym=>{const days=monthDays(ym),successful=new Set(monthUpdatesFor(ym).filter(x=>x.status).map(x=>x.update_date)),active=successful.size,percent=Math.round(active/days.length*100);return `<button class="month-row ${ym===selectedMonth?"active":""}" data-month="${ym}" type="button"><span class="month-name">${monthLabel(ym)}</span><span class="month-track"><i style="width:${percent}%"></i></span><strong>${active}/${days.length}</strong></button>`}).join("");
 $$("[data-month]").forEach(b=>b.addEventListener("click",()=>{selectedMonth=b.dataset.month;page=1;renderAll();scrollToTable()}));
}
function renderAll(){
 $("#monthSelect").value=selectedMonth;renderStats();render();renderMonthlyOverview();
}
function scrollToTable(){setTimeout(()=>$("#schemeTablePanel")?.scrollIntoView({behavior:"smooth",block:"start"}),30)}
function openScheme(id){
 const s=schemes.find(x=>Number(x.id)===id);if(!s)return;lastFocusedScheme=document.activeElement;
 const rows=monthDays(selectedMonth).map(d=>{const x=updates.find(v=>Number(v.scheme_id)===id&&v.update_date===d);return `<div class="history-day ${x?.status===true?"done":x?.status===false?"notdone":"none"}"><span>${d.slice(-2)}</span><b>${x?.status===true?"✓":x?.status===false?"✕":"—"}</b></div>`}).join("");
 $("#modalTitle").textContent=s.scheme_name;$("#modalPerson").textContent=s.person_name;$("#modalBfm").innerHTML=bfmBadge(s.bfm_status);$("#modalType").textContent=s.person_type;$("#modalLastUpdate").textContent=latestUpdate(s)?fmtDate(latestUpdate(s)):"—";$("#modalMonth").textContent=monthLabel(selectedMonth);$("#modalMonthCount").textContent=`${monthlyCount(s)} / ${monthDays(selectedMonth).length}`;$("#modalHistory").innerHTML=rows;
 const m=$("#schemeModal");m.hidden=false;m.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");$(".modal-close").focus();
}
function closeModal(){const m=$("#schemeModal");m.hidden=true;m.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");if(lastFocusedScheme?.focus)lastFocusedScheme.focus()}
async function load(){
 if(!cfg?.SUPABASE_URL||cfg.SUPABASE_URL.includes("PASTE_"))throw new Error("Add your Supabase values to config.js first.");
 [schemes,updates]=await Promise.all([api("schemes?select=id,scheme_name,person_type,person_name,bfm_status&order=scheme_name"),api("bfm_updates?select=scheme_id,update_date,status,created_at&order=update_date.desc")]);
 availableMonths=[...new Set(updates.map(x=>x.update_date?.slice(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));if(!availableMonths.includes(currentMonth()))availableMonths.unshift(currentMonth());if(!selectedMonth||!availableMonths.includes(selectedMonth))selectedMonth=currentMonth();
 $("#today").textContent=fmtDate(todayISO());$("#lastUpdated").textContent=new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:INDIA_TZ}).format(new Date());
 $("#monthSelect").innerHTML=availableMonths.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join("");renderAll();
}
$("#search").addEventListener("input",e=>{search=e.target.value.toLowerCase().trim();page=1;render()});
$("#statusFilter").addEventListener("change",e=>{statusFilter=e.target.value;page=1;render()});
$("#sortSelect").addEventListener("change",e=>{sort=e.target.value;page=1;render()});
$("#monthSelect").addEventListener("change",e=>{selectedMonth=e.target.value;selectedFilter="all";page=1;renderAll();scrollToTable()});
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{selectedFilter=b.dataset.filter;page=1;renderAll();scrollToTable()}));
$("#refresh").addEventListener("click",()=>load().catch(e=>$("#message").textContent=e.message));
$$('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$("#schemeModal").hidden)closeModal()});
load().catch(e=>$("#message").textContent="Unable to load dashboard. Please try again.");
