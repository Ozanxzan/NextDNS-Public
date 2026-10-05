const $=s=>document.querySelector(s);
const fmt=n=>Number(n||0).toLocaleString("en-US");
function set(id,v){const e=$("#"+id);if(e)e.textContent=v}
function pct(a,b){return b?Math.round(a/b*100):0}
async function load(){
  try{
    const r=await fetch("/api/public");
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"Unable to load public data");

    set("queries",fmt(d.queries24h));
    set("blocked",fmt(d.blocked24h));
    set("rate",pct(d.blocked24h,d.queries24h)+"%");
    set("encrypted",pct(d.encrypted24h,d.queries24h)+"%");
    set("networkState","ONLINE");
    set("updated","Updated "+new Date(d.generatedAt).toLocaleTimeString());
    set("profileName",d.publicName||"Nazuaf DNS");
    set("filtering",d.blocked24h>0?"ACTIVE":"READY");
    set("encState",d.encrypted24h>0?"ACTIVE":"—");
    set("dnssec",d.dnssec24h?"ACTIVE":"—");

    const bars=$("#bars"); bars.innerHTML="";
    const max=Math.max(...(d.hourly||[]).map(x=>x.queries),1);
    (d.hourly||[]).forEach(x=>{
      const b=document.createElement("i"); b.className="bar";
      b.style.height=Math.max(3,Math.round(x.queries/max*100))+"%";
      b.title=`${x.hour}: ${fmt(x.queries)} queries`;
      bars.append(b);
    });
  }catch(e){
    set("networkState","OFFLINE");
    set("updated",e.message);
  }
}
$("#theme").onclick=()=>{document.body.classList.toggle("light");localStorage.theme=document.body.classList.contains("light")?"light":"dark"};
if(localStorage.theme==="light")document.body.classList.add("light");
load(); setInterval(load,60000);
