(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let reportData=null;

function ensureStyle(){
  if($('#bwaAdminOverviewReportStyle'))return;
  const link=document.createElement('link');
  link.id='bwaAdminOverviewReportStyle';
  link.rel='stylesheet';
  link.href='/assets/admin-overview-reports.css?rev=20260812-1';
  document.head.appendChild(link);
}

function mount(){
  const panel=$('[data-panel="overview"]');
  if(!panel||$('#adminBusinessReports'))return $('#adminBusinessReports');
  const existing=panel.querySelector('.admin-two-col');
  const section=document.createElement('section');
  section.id='adminBusinessReports';
  section.className='admin-report-suite';
  section.innerHTML=`
    <div class="admin-report-heading">
      <div><p class="eyebrow">REPORTING</p><h2>Business performance</h2><p>Revenue, order health, student growth and course performance calculated from live database records.</p></div>
      <div class="admin-report-updated" id="adminReportsUpdated">Loading reports…</div>
    </div>
    <div class="admin-report-kpis" id="adminReportKpis">
      ${Array.from({length:6},()=>'<article class="admin-report-kpi admin-report-skeleton"></article>').join('')}
    </div>
    <div class="admin-report-grid">
      <article class="admin-card admin-report-wide">
        <div class="admin-card-head"><div><h2>Sales trend</h2><p>Completed revenue and all orders · last 14 days</p></div><span class="admin-report-chip">Live DB</span></div>
        <div id="adminSalesTrend" class="admin-report-chart admin-report-skeleton-block"></div>
      </article>
      <article class="admin-card">
        <div class="admin-card-head"><div><h2>Order health</h2><p>Current status distribution</p></div></div>
        <div id="adminOrderHealth" class="admin-report-skeleton-block"></div>
      </article>
      <article class="admin-card admin-report-wide">
        <div class="admin-card-head"><div><h2>Course performance</h2><p>Enrollments and completed order-item revenue</p></div></div>
        <div id="adminCoursePerformance" class="admin-report-table-wrap admin-report-skeleton-block"></div>
      </article>
      <article class="admin-card">
        <div class="admin-card-head"><div><h2>Payment mix</h2><p>Completed orders only</p></div></div>
        <div id="adminPaymentMix" class="admin-report-skeleton-block"></div>
      </article>
      <article class="admin-card admin-report-full">
        <div class="admin-card-head"><div><h2>6-month growth</h2><p>New students, enrollments and completed revenue by month</p></div></div>
        <div id="adminGrowthReport" class="admin-growth-grid admin-report-skeleton-block"></div>
      </article>
    </div>
    <p class="admin-report-footnote">Platform revenue uses completed order totals. Course revenue uses completed order-item prices, so coupon/discounted orders can make the course-level total differ from platform revenue.</p>`;
  if(existing)panel.insertBefore(section,existing);else panel.appendChild(section);
  return section;
}

function money(value){
  const symbol=reportData?.currency_symbol||'Rs';
  return `${symbol} ${Number(value||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
}
function number(value){return Number(value||0).toLocaleString('en-PK')}
function percent(value){return `${Number(value||0).toLocaleString('en-PK',{maximumFractionDigits:1})}%`}
function statusLabel(value){return String(value||'unknown').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function paymentLabel(value){return String(value||'Unknown').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function shortMoney(value){
  const n=Number(value||0),symbol=reportData?.currency_symbol||'Rs';
  if(n>=1000000)return `${symbol} ${(n/1000000).toFixed(n>=10000000?0:1)}M`;
  if(n>=1000)return `${symbol} ${(n/1000).toFixed(n>=100000?0:1)}k`;
  return `${symbol} ${Math.round(n).toLocaleString('en-PK')}`;
}
function updateText(id,text){const el=$(id);if(el)el.textContent=text}

function renderKpis(){
  const s=reportData.summary||{};
  const cards=[
    ['Revenue this month',money(s.revenue_this_month),`${number(s.orders_this_month)} orders recorded this month`,'revenue'],
    ['Revenue today',money(s.revenue_today),`${number(s.orders_today)} orders today`,'today'],
    ['Average order value',money(s.average_order_value),`${number(s.completed_orders)} completed orders overall`,'average'],
    ['New students',number(s.new_students_this_month),'Registered this month','students'],
    ['New enrollments',number(s.new_enrollments_this_month),'Course access added this month','enrollments'],
    ['Course completion',percent(s.completion_rate),`${percent(s.order_completion_rate)} order completion rate`,'completion'],
  ];
  $('#adminReportKpis').innerHTML=cards.map(([label,value,sub,key])=>`<article class="admin-report-kpi" data-report-kpi="${key}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></article>`).join('');
}

function renderSalesTrend(){
  const days=reportData.daily||[];
  const maxRevenue=Math.max(1,...days.map(d=>Number(d.revenue||0)));
  const maxOrders=Math.max(1,...days.map(d=>Number(d.orders||0)));
  $('#adminSalesTrend').classList.remove('admin-report-skeleton-block');
  $('#adminSalesTrend').innerHTML=days.length?`<div class="admin-sales-bars">${days.map((d,i)=>{
    const revenueHeight=Math.max(Number(d.revenue||0)>0?5:0,Math.round(Number(d.revenue||0)/maxRevenue*100));
    const orderHeight=Math.max(Number(d.orders||0)>0?4:0,Math.round(Number(d.orders||0)/maxOrders*100));
    return `<div class="admin-sales-day" title="${esc(d.label)} — ${esc(money(d.revenue))} completed revenue · ${number(d.orders)} order(s)">
      <div class="admin-sales-bar-area"><i class="admin-sales-revenue" style="height:${revenueHeight}%"></i><i class="admin-sales-orders" style="height:${orderHeight}%"></i></div>
      <span>${esc(i%2===0||i===days.length-1?d.label:'')}</span>
    </div>`;
  }).join('')}</div><div class="admin-report-legend"><span><i class="legend-revenue"></i>Completed revenue</span><span><i class="legend-orders"></i>Orders</span><b>${shortMoney(days.reduce((sum,d)=>sum+Number(d.revenue||0),0))} / 14 days</b></div>`:'<div class="admin-empty">No sales data yet.</div>';
}

function renderOrderHealth(){
  const list=reportData.status_breakdown||[];
  const total=Math.max(1,list.reduce((sum,row)=>sum+Number(row.orders||0),0));
  const summary=reportData.summary||{};
  const el=$('#adminOrderHealth');el.classList.remove('admin-report-skeleton-block');
  el.innerHTML=`<div class="admin-health-summary"><div><span>Pending value</span><strong>${esc(money(summary.pending_value))}</strong></div><div><span>Refunded value</span><strong>${esc(money(summary.refunded_value))}</strong></div></div>${list.map(row=>{
    const width=Math.round(Number(row.orders||0)/total*100);
    return `<div class="admin-health-row"><div><strong>${esc(statusLabel(row.status))}</strong><span>${number(row.orders)} orders · ${esc(money(row.value))}</span></div><div class="admin-health-progress"><i data-status="${esc(row.status)}" style="width:${width}%"></i></div><b>${width}%</b></div>`;
  }).join('')||'<div class="admin-empty">No orders found.</div>'}`;
}

function renderPaymentMix(){
  const list=reportData.payment_methods||[];
  const max=Math.max(1,...list.map(row=>Number(row.revenue||0)));
  const el=$('#adminPaymentMix');el.classList.remove('admin-report-skeleton-block');
  el.innerHTML=list.map(row=>`<div class="admin-payment-row"><div><strong>${esc(paymentLabel(row.payment_method))}</strong><span>${number(row.orders)} completed orders</span></div><div><b>${esc(money(row.revenue))}</b><div class="admin-payment-progress"><i style="width:${Math.round(Number(row.revenue||0)/max*100)}%"></i></div></div></div>`).join('')||'<div class="admin-empty">No completed payments yet.</div>';
}

function renderCoursePerformance(){
  const rows=reportData.top_courses||[];
  const el=$('#adminCoursePerformance');el.classList.remove('admin-report-skeleton-block');
  el.innerHTML=rows.length?`<table class="admin-report-table"><thead><tr><th>Course</th><th>Status</th><th>Enrollments</th><th>Paid orders</th><th>Item revenue</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td><div class="admin-report-course"><span>${index+1}</span><div><strong>${esc(row.title)}</strong><small>${esc(row.slug)}</small></div></div></td><td><span class="status-pill status-${esc(row.status)}">${esc(statusLabel(row.status))}</span></td><td>${number(row.enrollments)}</td><td>${number(row.completed_orders)}</td><td><strong>${esc(money(row.revenue))}</strong></td></tr>`).join('')}</tbody></table>`:'<div class="admin-empty">No course performance data yet.</div>';
}

function renderGrowth(){
  const rows=reportData.monthly_growth||[];
  const maxStudents=Math.max(1,...rows.map(r=>Number(r.students||0)));
  const maxEnrollments=Math.max(1,...rows.map(r=>Number(r.enrollments||0)));
  const maxRevenue=Math.max(1,...rows.map(r=>Number(r.revenue||0)));
  const el=$('#adminGrowthReport');el.classList.remove('admin-report-skeleton-block');
  el.innerHTML=rows.map(row=>`<article class="admin-growth-month"><header><strong>${esc(row.label)}</strong><b>${esc(shortMoney(row.revenue))}</b></header><div class="admin-growth-metric"><span>Students <b>${number(row.students)}</b></span><div><i class="growth-students" style="width:${Math.round(Number(row.students||0)/maxStudents*100)}%"></i></div></div><div class="admin-growth-metric"><span>Enrollments <b>${number(row.enrollments)}</b></span><div><i class="growth-enrollments" style="width:${Math.round(Number(row.enrollments||0)/maxEnrollments*100)}%"></i></div></div><div class="admin-growth-metric"><span>Revenue <b>${esc(money(row.revenue))}</b></span><div><i class="growth-revenue" style="width:${Math.round(Number(row.revenue||0)/maxRevenue*100)}%"></i></div></div></article>`).join('')||'<div class="admin-empty">No growth data yet.</div>';
}

function syncPrimaryMetrics(){
  const s=reportData.summary||{};
  if(s.revenue_total!==undefined)updateText('#adminRevenue',money(s.revenue_total));
  const revenueCard=$('#adminRevenue')?.closest('article');
  const revenueSmall=revenueCard?.querySelector('small');
  if(revenueSmall)revenueSmall.textContent=`${number(s.completed_orders)} completed orders`;
  const ordersCard=$('#adminOrderCount')?.closest('article');
  const ordersSmall=ordersCard?.querySelector('small');
  if(ordersSmall)ordersSmall.textContent=`${number(s.pending_orders)} pending · ${number(s.refunded_orders)} refunded`;
}

function render(){
  renderKpis();renderSalesTrend();renderOrderHealth();renderCoursePerformance();renderPaymentMix();renderGrowth();syncPrimaryMetrics();
  const stamp=reportData.generated_at?new Date(reportData.generated_at):new Date();
  updateText('#adminReportsUpdated',`Updated ${stamp.toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}`);
}

async function backend(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,50));
  if(!window.BWABackend)throw new Error('Backend bridge did not load.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Laravel backend is unavailable.');
  return window.BWABackend;
}

async function loadReports(){
  mount();
  updateText('#adminReportsUpdated','Refreshing reports…');
  try{
    const bridge=await backend();
    const response=await bridge.api('/api/admin/overview');
    reportData=response?.reports||null;
    if(!reportData)throw new Error('Report data was not returned by the server.');
    render();
  }catch(err){
    console.warn('[BWA admin reports]',err);
    updateText('#adminReportsUpdated','Reports unavailable');
    const grid=$('#adminReportKpis');
    if(grid)grid.innerHTML=`<div class="admin-report-error">${esc(err?.message||'Could not load advanced reports.')}</div>`;
  }
}

ensureStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadReports,{once:true});else loadReports();
document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('#adminRefresh'))setTimeout(loadReports,250)},true);
window.BWAAdminOverviewReports={refresh:loadReports};
})();
