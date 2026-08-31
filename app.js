const cfg=window.BFM_CONFIG,$=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const todayISO=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`};
const fmt=d=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(d+"T00:00:00"));
async function api(path){const r=await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:cfg.SUPABASE_KEY,Authorization:`Bearer ${cfg.SUPABASE_KEY}`}});if(!r.ok)throw Error(await r.text());return r.json()}
let page=1,perPage=5,total=0,selected=null,search="";
async function load(){
 try{
  const q=search?`&or=(scheme_name.ilike.*${encodeURIComponent(search)}*,jal_mitra_name.ilike.*${encodeURIComponent(search)}*)`:"";
  const countR=await fetch(`${cfg.SUPABASE_URL}/rest/v1/schemes?select=id${q}`,{headers:{apikey:cfg.SUPABASE_KEY,Prefer:"count=exact",Range:"0-0"}});
  total=Number((countR.headers.get("content-range")||"*/0").split("/")[1]||0);
  const start=(page-1)*perPage;
  const schemes=await api(`schemes?select=id,scheme_name,jal_mitra_name&order=scheme_name&offset=${start}&limit=${perPage}${q}`);
  const ids=schemes.map(x=>x.id);
  const updates=ids.length?await api(`bfm_updates?select=scheme_id,update_date,status&scheme_id=in.(${ids.join(",")})&order=update_date.desc`):[];
  const today=todayISO(),u=updates.filter(x=>x.update_date===today&&x.status).length;
  $("#topDate").textContent=fmt(today);$("#total").textContent=total;$("#updated").textContent=u;$("#pending").textContent=Math.max(0,total-u);$("#completion").textContent=total?Math.round(u/total*100)+"%":"0%";
  const map=new Map(updates.map(x=>[x.scheme_id,x]));
  $("#range").textContent=total?`${start+1}–${Math.min(start+schemes.length,total)} of ${total}`:"0 of 0";
  $("#schemeList").innerHTML=schemes.map(s=>{const x=updates.find(z=>z.scheme_id===s.id&&z.update_date===today);return `<button class="scheme-card" data-id="${s.id}"><span><b>${esc(s.scheme_name)}</b><small>Jal Mitra: ${esc(s.jal_mitra_name)}</small></span><span class="badge ${x?.status===true?"yes":x?.status===false?"no":"unknown"}">${x?.status===true?"✓":x?.status===false?"✕":"—"}</span></button>`}).join("")||`<div class="panel center muted">No schemes found.</div>`;
  document.querySelectorAll(".scheme-card").forEach(b=>b.onclick=()=>showDetail(Number(b.dataset.id)));
  renderPages(); $("#message").textContent="";
 }catch(e){$("#message").textContent="Unable to load data: "+e.message}
}
function renderPages(){const n=Math.max(1,Math.ceil(total/perPage));let a=[];for(let i=1;i<=n;i++){if(n>7&&i>3&&i<n-2){if(i===4)a.push("<span>…</span>");continue}a.push(`<button class="${i===page?"active":""}" data-p="${i}">${i}</button>`)}$("#pagination").innerHTML=`<button data-p="${Math.max(1,page-1)}">‹</button>${a.join("")}<button data-p="${Math.min(n,page+1)}">›</button>`;document.querySelectorAll("#pagination button").forEach(b=>b.onclick=()=>{page=Number(b.dataset.p);load();scrollTo(0,0)})}
async function showDetail(id){selected=id;const s=await api(`schemes?id=eq.${id}&select=id,scheme_name,jal_mitra_name`);if(!s[0])return;const u=await api(`bfm_updates?scheme_id=eq.${id}&select=update_date,status&order=update_date.desc&limit=60`);const today=u.find(x=>x.update_date===todayISO());$("#detail").hidden=false;$("#detail").innerHTML=`<button class="back" onclick="document.querySelector('#detail').hidden=true">← Back to schemes</button><div class="detail-head"><div class="eyebrow">SCHEME DETAILS</div><h2>${esc(s[0].scheme_name)}</h2><p class="muted">Jal Mitra: ${esc(s[0].jal_mitra_name)}</p></div><div class="current ${today?.status===true?"current-yes":today?.status===false?"current-no":""}">${today?.status===true?"✓ UPDATED TODAY":today?.status===false?"✕ NOT UPDATED TODAY":"— NO UPDATE RECORDED TODAY"}</div><h3>Date-wise BFM Status</h3><div class="history-grid">${u.map(x=>`<div class="history-day"><small>${fmt(x.update_date)}</small><span class="badge ${x.status?"yes":"no"}">${x.status?"✓":"✕"}</span></div>`).join("")||'<p class="muted">No history available.</p>'}</div>`;$("#detail").scrollIntoView({behavior:"smooth",block:"start"})}
$("#search").oninput=e=>{search=e.target.value.trim();page=1;load()};load();