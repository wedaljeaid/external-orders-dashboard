
const CFG={googleSheetId:"1LM7ZYKm8PNG8kRKx5i5rWTGdY5csSlhO",googleSheetGid:"0",publishedCsvUrl:"",autoRefreshMinutes:15,fallbackDataUrl:"./data/external_orders.json",...(window.DASHBOARD_CONFIG||{})};
const MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const COLORS={"تم التسليم":"#2d9c8f","مرفوض":"#d95d39","تحت الاجراء":"#f2a65a","معلق عند مقدم الطلب":"#6c8aa0","غير محدد":"#9db4c0"};
const charts={}; let master=[],filtered=[];
document.addEventListener("DOMContentLoaded",init);
async function init(){initCharts();bindFilters();await loadData();if(CFG.autoRefreshMinutes>0){setInterval(loadData,CFG.autoRefreshMinutes*60000);}}
function liveUrl(){return CFG.publishedCsvUrl||`https://docs.google.com/spreadsheets/d/${CFG.googleSheetId}/export?format=csv&gid=${CFG.googleSheetGid||0}`;}
function txt(v){return String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()||"غير محدد";}
function val(row,key){const direct=row[key]; if(direct!==undefined) return direct; const wanted=txt(key); const found=Object.keys(row).find((k)=>txt(k)===wanted); return found?row[found]:"";}
function parseDate(raw){
  const s=txt(raw);
  if(!s||s==="غير محدد"||s==="-") return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const parts=s.split("-").map(Number);
    return makeDate(parts[0],parts[1],parts[2]);
  }
  const p=s.split(/[/-]/).map(Number);
  if(p.length!==3||p.some(Number.isNaN)) return null;
  let d,m,y;
  if(String(p[0]).length===4){[y,m,d]=p;} else if(p[0]>12){[d,m,y]=p;} else if(p[1]>12){[m,d,y]=p;} else {[d,m,y]=p;}
  return makeDate(y,m,d);
}
function makeDate(y,m,d){
  if(!y||!m||!d) return null;
  const x=new Date(y,m-1,d);
  return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null;
}
function bucket(days){
  if(days==null) return "لا يوجد تاريخ تسليم";
  if(days<0) return "تعارض زمني";
  if(days<=7) return "0-7 أيام";
  if(days<=30) return "8-30 يومًا";
  return "أكثر من 30 يومًا";
}
function normalize(rows){
  return rows.map((row)=>{
    const reqText=txt(val(row,"تاريخ استلام الطلب"));
    const delText=txt(val(row,"تاريخ تسليم الطلب"));
    const req=parseDate(reqText), del=parseDate(delText);
    const days=req&&del?Math.round((del-req)/86400000):null;
    return {
      requestDate:req, deliveryDate:del, requestDateText:reqText, deliveryDateText:delText,
      status:txt(val(row,"حالة الطلب")), entityType:txt(val(row,"جهة الطلب")), requestType:txt(val(row,"نوع الطلب")),
      requester:txt(val(row,"اسم طالب البيانات (فرد أو جهة )")), submitter:txt(val(row,"اسم مقدم الطلب")),
      dataType:txt(val(row,"نوع البيانات المطلوبة")), purpose:txt(val(row,"الغرض من البيانات المطلوبة")), requestedData:txt(val(row,"البيانات المطلوبة")),
      department:txt(val(row,"اسم الإدارة")), provider:txt(val(row,"مزود البيانات")), subRequestType:txt(val(row,"نوع الطلب 2")),
      region:txt(val(row,"المحافظة ")).replace(/^المملكة$/,"كامل المملكة"), turnaroundDays:days, turnaroundBucket:bucket(days),
      monthKey:req?(req.getFullYear()+"-"+String(req.getMonth()+1).padStart(2,"0")):"غير معروف",
      monthLabel:req?(MONTHS[req.getMonth()]+" "+req.getFullYear()):"غير معروف"
    };
  }).filter((r)=>r.requestDate||r.status!=="غير محدد");
}
async function loadData(){
  const source=document.getElementById("source-status");
  const refresh=document.getElementById("refresh-status");
  source.textContent="جارٍ جلب البيانات";
  try{
    const res=await fetch(liveUrl(),{cache:"no-store"});
    const text=await res.text();
    if(!res.ok||!text||text.trim().startsWith("<!DOCTYPE html")) throw new Error("csv");
    master=normalize(Papa.parse(text,{header:true,skipEmptyLines:true}).data);
    source.textContent="المصدر المباشر: Google Sheets";
    source.classList.remove("muted");
  }catch(e){
    const res=await fetch(CFG.fallbackDataUrl,{cache:"no-store"});
    const json=await res.json();
    master=normalize(json.records||[]);
    source.textContent="المصدر الحالي: نسخة احتياطية محلية";
    source.classList.add("muted");
  }
  refresh.textContent="آخر تحديث: "+new Date().toLocaleString("ar-SA");
  fillFilters();
  applyFilters();
}
function bindFilters(){
  ["filter-start-date","filter-end-date","filter-entity-type","filter-status","filter-purpose","filter-data-type"].forEach((id)=>document.getElementById(id).addEventListener("change",applyFilters));
  document.getElementById("reset-filters").addEventListener("click",()=>{
    ["filter-start-date","filter-end-date"].forEach((id)=>document.getElementById(id).value="");
    ["filter-entity-type","filter-status","filter-purpose","filter-data-type"].forEach((id)=>document.getElementById(id).value="الكل");
    applyFilters();
  });
}
function fillFilters(){
  fillSelect("filter-entity-type",master.map((x)=>x.entityType));
  fillSelect("filter-status",master.map((x)=>x.status));
  fillSelect("filter-purpose",master.map((x)=>x.purpose));
  fillSelect("filter-data-type",master.map((x)=>x.dataType));
}
function fillSelect(id,values){
  const el=document.getElementById(id);
  const cur=el.value||"الكل";
  const opts=["الكل",...new Set(values)].sort((a,b)=>a.localeCompare(b,"ar"));
  el.innerHTML=opts.map((x)=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  el.value=opts.includes(cur)?cur:"الكل";
}
function browserDate(v){if(!v) return null; const p=v.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]);}
function applyFilters(){
  const s=browserDate(document.getElementById("filter-start-date").value), e=browserDate(document.getElementById("filter-end-date").value);
  const entity=document.getElementById("filter-entity-type").value, status=document.getElementById("filter-status").value, purpose=document.getElementById("filter-purpose").value, dataType=document.getElementById("filter-data-type").value;
  filtered=master.filter((r)=>{
    if(s&&(!r.requestDate||r.requestDate<s)) return false;
    if(e&&(!r.requestDate||r.requestDate>e)) return false;
    if(entity!=="الكل"&&r.entityType!==entity) return false;
    if(status!=="الكل"&&r.status!==status) return false;
    if(purpose!=="الكل"&&r.purpose!==purpose) return false;
    if(dataType!=="الكل"&&r.dataType!==dataType) return false;
    return true;
  });
  render(filtered);
}
function countBy(rows,key){const m=new Map(); rows.forEach((r)=>m.set(r[key]||"غير محدد",(m.get(r[key]||"غير محدد")||0)+1)); return m;}
function topEntry(map){const e=[...map.entries()].filter((x)=>x[0]!=="غير محدد").sort((a,b)=>b[1]-a[1])[0]; return e?{label:e[0],value:e[1]}:{label:"غير محدد",value:0};}
function avg(list){return list.length?list.reduce((a,b)=>a+b,0)/list.length:0;}
function fmtNum(v){return new Intl.NumberFormat("ar-SA").format(v||0);} 
function fmtPct(v){return new Intl.NumberFormat("ar-SA",{style:"percent",maximumFractionDigits:1}).format(v||0);} 
function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function topItems(map,n){return [...map.entries()].filter((x)=>x[0]&&x[0]!=="غير محدد").sort((a,b)=>b[1]-a[1]).slice(0,n);} 
function short(v,n){return v.length>n?v.slice(0,n)+"...":v;}
function trend(rows){
  const m=new Map();
  rows.filter((r)=>r.requestDate).forEach((r)=>{if(!m.has(r.monthKey)) m.set(r.monthKey,{label:r.monthLabel,count:0}); m.get(r.monthKey).count++;});
  return [...m.entries()].map((x)=>({key:x[0],label:x[1].label,count:x[1].count})).sort((a,b)=>a.key.localeCompare(b.key));
}
function initCharts(){["trend-chart","status-chart","entity-chart","requesters-chart","data-types-chart","purpose-chart","regions-chart","workload-chart"].forEach((id)=>charts[id]=echarts.init(document.getElementById(id))); window.addEventListener("resize",()=>Object.values(charts).forEach((c)=>c.resize()));}
function plotTrend(data){charts["trend-chart"].setOption({tooltip:{trigger:"axis"},grid:{left:24,right:24,bottom:20,containLabel:true},xAxis:{type:"category",data:data.map((x)=>x.label),axisLabel:{color:"#5c7382",rotate:28}},yAxis:{type:"value",axisLabel:{color:"#5c7382"}},series:[{type:"line",smooth:true,symbolSize:8,data:data.map((x)=>x.count),lineStyle:{color:"#0b7285",width:4},itemStyle:{color:"#0b7285"},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(11,114,133,.34)"},{offset:1,color:"rgba(11,114,133,.04)"}])}}]});}
function plotPie(id,data,rose){charts[id].setOption({tooltip:{trigger:"item"},legend:{bottom:0,textStyle:{color:"#5c7382"}},series:[{type:"pie",roseType:rose?"radius":false,radius:rose?[34,118]:["48%","72%"],center:["50%",rose?"50%":"44%"],label:{color:"#153243",formatter:rose?"{b}\n{c}":"{b}\n{d}%"},data:data}]});}
function plotBar(id,data,color,horizontal,limit){const labels=data.map((x)=>limit?short(x[0],limit):x[0]), values=data.map((x)=>x[1]); charts[id].setOption({tooltip:{trigger:"axis",axisPointer:{type:"shadow"}},grid:{top:10,left:18,right:14,bottom:horizontal?12:48,containLabel:true},xAxis:horizontal?{type:"value",axisLabel:{color:"#5c7382"}}:{type:"category",data:labels,axisLabel:{color:"#5c7382",rotate:horizontal?0:22}},yAxis:horizontal?{type:"category",data:labels,axisLabel:{color:"#153243"}}:{type:"value",axisLabel:{color:"#5c7382"}},series:[{type:"bar",data:values,itemStyle:{color:color,borderRadius:[12,12,12,12]}}]});}
if (typeof CFG.dataEndpoint === "undefined") CFG.dataEndpoint = "";
if (typeof CFG.sourceLabel === "undefined") CFG.sourceLabel = "Google Sheets";
function isRespondedStatus(status){return status==="تم التسليم"||status==="مرفوض";}
function isOpenStatus(status){return status==="تحت الاجراء"||status==="معلق عند مقدم الطلب";}
function bucket(days,status){if(days==null) return isOpenStatus(status)?"طلبات مفتوحة":"تواريخ أو إغلاقات ناقصة"; if(days<0) return "تواريخ غير متسقة"; if(days<=7) return "استجابة خلال 7 أيام"; if(days<=30) return "استجابة خلال 8-30 يومًا"; return "استجابة بعد أكثر من 30 يومًا";}
function normalize(rows){
  return rows.map((row)=>{
    const reqText=txt(val(row,"تاريخ استلام الطلب"));
    const delText=txt(val(row,"تاريخ تسليم الطلب"));
    const req=parseDate(reqText), del=parseDate(delText);
    const status=txt(val(row,"حالة الطلب"));
    const days=req&&del?Math.round((del-req)/86400000):null;
    return {requestDate:req,deliveryDate:del,requestDateText:reqText,deliveryDateText:delText,status,entityType:txt(val(row,"جهة الطلب")),requestType:txt(val(row,"نوع الطلب")),requester:txt(val(row,"اسم طالب البيانات (فرد أو جهة )")),submitter:txt(val(row,"اسم مقدم الطلب")),dataType:txt(val(row,"نوع البيانات المطلوبة")),purpose:txt(val(row,"الغرض من البيانات المطلوبة")),requestedData:txt(val(row,"البيانات المطلوبة")),department:txt(val(row,"اسم الإدارة")),provider:txt(val(row,"مزود البيانات")),subRequestType:txt(val(row,"نوع الطلب 2")),region:txt(val(row,"المحافظة ")).replace(/^المملكة$/,"كامل المملكة"),turnaroundDays:days,turnaroundBucket:bucket(days,status),monthKey:req?(req.getFullYear()+"-"+String(req.getMonth()+1).padStart(2,"0")):"غير معروف",monthLabel:req?(MONTHS[req.getMonth()]+" "+req.getFullYear()):"غير معروف"};
  }).filter((r)=>r.requestDate||r.status!=="غير محدد");
}
async function fetchRowsFromEndpoint(){
  if(!CFG.dataEndpoint) return null;
  const res=await fetch(CFG.dataEndpoint,{cache:"no-store"});
  if(!res.ok) throw new Error("endpoint");
  const payload=await res.json();
  return payload.records||payload.data||payload;
}
async function loadData(){
  const source=document.getElementById("source-status"), refresh=document.getElementById("refresh-status");
  source.textContent="جارٍ جلب البيانات";
  try{
    const endpointRows=await fetchRowsFromEndpoint();
    if(endpointRows){
      master=normalize(endpointRows);
      source.textContent="المصدر المباشر: "+(CFG.sourceLabel||"Google Sheets API");
      source.classList.remove("muted");
    } else {
      const res=await fetch(liveUrl(),{cache:"no-store"});
      const text=await res.text();
      if(!res.ok||!text||text.trim().startsWith("<!DOCTYPE html")) throw new Error("csv");
      master=normalize(Papa.parse(text,{header:true,skipEmptyLines:true}).data);
      source.textContent="المصدر المباشر: Google Sheets";
      source.classList.remove("muted");
    }
  } catch(e){
    const res=await fetch(CFG.fallbackDataUrl,{cache:"no-store"});
    const json=await res.json();
    master=normalize(json.records||[]);
    source.textContent="المصدر الحالي: نسخة احتياطية محلية";
    source.classList.add("muted");
  }
  refresh.textContent="آخر تحديث: "+new Date().toLocaleString("ar-SA");
  fillFilters();
  applyFilters();
}
function short(v,n){
  const words=String(v||"").split(" ");
  let line="", out=[];
  words.forEach((w)=>{
    const next=(line?line+" ":"")+w;
    if(next.length>n&&line){out.push(line); line=w;} else {line=next;}
  });
  if(line) out.push(line);
  return out.join("\n");
}
function render(rows){
  const status=countBy(rows,"status"), entity=countBy(rows,"entityType"), requester=countBy(rows,"requester"), dataType=countBy(rows,"dataType"), purpose=countBy(rows,"purpose"), region=countBy(rows,"region"), workload=countBy(rows,"turnaroundBucket");
  const responded=rows.filter((r)=>isRespondedStatus(r.status)), delivered=rows.filter((r)=>r.status==="تم التسليم"), rejected=rows.filter((r)=>r.status==="مرفوض"), inProgress=rows.filter((r)=>r.status==="تحت الاجراء"), waitingSubmitter=rows.filter((r)=>r.status==="معلق عند مقدم الطلب");
  const valid=responded.filter((r)=>Number.isFinite(r.turnaroundDays)&&r.turnaroundDays>=0);
  const excluded=responded.length-valid.length;
  const completion=rows.length?(responded.length/rows.length):0;
  const tr=trend(rows), topPurpose=topEntry(purpose), topRequester=topEntry(requester), topData=topEntry(dataType), topRegion=topEntry(region), topMonth=[...tr].sort((a,b)=>b.count-a.count)[0];
  const kpis=[];
  kpis.push(["إجمالي عدد الطلبات",fmtNum(rows.length),"عدد السجلات بعد التصفية الحالية"]);
  kpis.push(["نسبة الإنجاز",fmtPct(completion),"يشمل الطلبات المسلمة والمرفوضة باعتبارها طلبات تم الرد عليها: "+fmtNum(responded.length)]);
  kpis.push(["طلبات قيد المتابعة",fmtNum(inProgress.length+waitingSubmitter.length),"تحت الإجراء: "+fmtNum(inProgress.length)+" | معلقة عند مقدم الطلب: "+fmtNum(waitingSubmitter.length)]);
  kpis.push(["متوسط المعالجة",valid.length?avg(valid.map((r)=>r.turnaroundDays)).toFixed(1)+" يوم":"غير متاح","محسوب على الطلبات التي تم الرد عليها ولها تاريخ استلام وتسليم صالحان. المستبعد: "+fmtNum(excluded)]);
  kpis.push(["حصة الجهات الحكومية",fmtPct(rows.length?((entity.get("جهات حكومية")||0)/rows.length):0),"القناة الرئيسية للطلب الحالي"]);
  kpis.push(["أعلى غرض",topPurpose.label,fmtNum(topPurpose.value)+" طلبًا"]);
  kpis.push(["أكثر جهة طلبًا",topRequester.label,fmtNum(topRequester.value)+" طلبًا"]);
  kpis.push(["أكثر نوع بيانات",topData.label,fmtNum(topData.value)+" طلبًا"]);
  document.getElementById("kpi-grid").innerHTML=kpis.map((k)=>"<article class=\"kpi-card\"><div class=\"kpi-label\">"+esc(k[0])+"</div><div class=\"kpi-value\">"+esc(k[1])+"</div><div class=\"kpi-note\">"+esc(k[2])+"</div></article>").join("");
  const summary=[];
  summary.push("<div class=\"summary-item\"><strong>المشهد العام</strong><span>إجمالي "+fmtNum(rows.length)+" طلبًا، مع رد على "+fmtNum(responded.length)+" منها.</span></div>");
  summary.push("<div class=\"summary-item\"><strong>الضغط الرئيسي</strong><span>الأكثر طلبًا: "+esc(topData.label)+"، والأكثر غرضًا: "+esc(topPurpose.label)+".</span></div>");
  summary.push("<div class=\"summary-item\"><strong>التمركز</strong><span>أعلى جهة: "+esc(topRequester.label)+"، وأعلى محافظة: "+esc(topRegion.label)+".</span></div>");
  document.getElementById("executive-summary").innerHTML=summary.join("");
  const insights=[];
  insights.push(["الاستجابة الرسمية","نسبة الإنجاز تحتسب الطلبات المسلمة والمرفوضة معًا لأنها تمثل طلبات تم الرد عليها."]);
  insights.push(["المتابعة التشغيلية","الطلبات المفتوحة الحالية = تحت الإجراء ("+fmtNum(inProgress.length)+") + معلقة عند مقدم الطلب ("+fmtNum(waitingSubmitter.length)+")."]);
  insights.push(["متوسط المعالجة","المتوسط محسوب على "+fmtNum(valid.length)+" طلبًا مكتمل التاريخ، مع استبعاد "+fmtNum(excluded)+" سجلًا غير صالح للحساب."]);
  insights.push(["الذروة الزمنية",topMonth?"أعلى شهر هو "+esc(topMonth.label)+" بعدد "+fmtNum(topMonth.count)+" طلبًا.":"لا توجد تواريخ كافية."]);
  insights.push(["سلامة البيانات",fmtNum(rows.filter((r)=>r.turnaroundDays<0).length)+" حالات تحتاج مراجعة بسبب تعارض أو نقص في التواريخ."]);
  document.getElementById("insights-list").innerHTML=insights.map((x)=>"<div class=\"insight-item\"><strong>"+esc(x[0])+"</strong><span>"+esc(x[1])+"</span></div>").join("");
  const workloadOrder=["استجابة خلال 7 أيام","استجابة خلال 8-30 يومًا","استجابة بعد أكثر من 30 يومًا","طلبات مفتوحة","تواريخ أو إغلاقات ناقصة","تواريخ غير متسقة"];
  plotTrend(tr);
  plotPie("status-chart",topItems(status,6).map((x)=>({name:x[0],value:x[1],itemStyle:{color:COLORS[x[0]]||"#9db4c0"}})));
  plotBar("entity-chart",topItems(entity,10),"#2d9c8f",true,22);
  plotBar("requesters-chart",topItems(requester,10),"#0b7285",true,24);
  plotBar("data-types-chart",topItems(dataType,8),"#f2a65a",false,18);
  plotBar("purpose-chart",topItems(purpose,10),"#6a9fb5",true,26);
  plotPie("regions-chart",topItems(region,8).map((x)=>({name:x[0],value:x[1]})),true);
  plotBar("workload-chart",workloadOrder.map((name)=>[name,workload.get(name)||0]),"#2d9c8f",true,22);
}
function plotTrend(data){
  charts["trend-chart"].setOption({tooltip:{trigger:"axis",confine:true,extraCssText:"max-width:360px;white-space:normal;direction:rtl;text-align:right;",formatter:(params)=>"<div dir=\"rtl\"><strong>"+params[0].axisValue+"</strong><br>عدد الطلبات: "+fmtNum(params[0].value)+"</div>"},grid:{left:24,right:24,bottom:20,containLabel:true},xAxis:{type:"category",data:data.map((x)=>x.label),axisLabel:{color:"#5c7382",rotate:28}},yAxis:{type:"value",axisLabel:{color:"#5c7382"}},series:[{type:"line",smooth:true,symbolSize:8,data:data.map((x)=>x.count),lineStyle:{color:"#0b7285",width:4},itemStyle:{color:"#0b7285"},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:"rgba(11,114,133,.34)"},{offset:1,color:"rgba(11,114,133,.04)"}])}}]});
}
function plotPie(id,data,rose){
  charts[id].setOption({tooltip:{trigger:"item",confine:true,extraCssText:"max-width:360px;white-space:normal;direction:rtl;text-align:right;",formatter:(p)=>"<div dir=\"rtl\"><strong>"+p.name+"</strong><br>العدد: "+fmtNum(p.value)+"<br>النسبة: "+fmtPct(p.percent/100)+"</div>"},legend:{bottom:0,textStyle:{color:"#5c7382"}},series:[{type:"pie",roseType:rose?"radius":false,radius:rose?[34,118]:["48%","72%"],center:["50%",rose?"50%":"44%"],label:{color:"#153243",formatter:rose?"{b}\n{c}":"{b}\n{d}%"},data:data}]});
}
function plotBar(id,data,color,horizontal,limit){
  const labels=data.map((x)=>limit?short(x[0],limit):x[0]), values=data.map((x)=>x[1]);
  charts[id].setOption({tooltip:{trigger:"axis",axisPointer:{type:"shadow"},confine:true,extraCssText:"max-width:380px;white-space:normal;direction:rtl;text-align:right;",formatter:(params)=>"<div dir=\"rtl\"><strong>"+params[0].name+"</strong><br>القيمة: "+fmtNum(params[0].value)+"</div>"},grid:{top:10,left:18,right:14,bottom:horizontal?12:52,containLabel:true},xAxis:horizontal?{type:"value",axisLabel:{color:"#5c7382"}}:{type:"category",data:labels,axisLabel:{color:"#5c7382",rotate:horizontal?0:0,interval:0}},yAxis:horizontal?{type:"category",data:labels,axisLabel:{color:"#153243",interval:0}}:{type:"value",axisLabel:{color:"#5c7382"}},series:[{type:"bar",data:values,itemStyle:{color:color,borderRadius:[12,12,12,12]}}]});
}
