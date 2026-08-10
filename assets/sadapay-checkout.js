(()=>{
'use strict';
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const money=n=>`Rs. ${Number(n||0).toLocaleString('en-PK')}`;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const remove=k=>localStorage.removeItem(k);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let courses=[],subtotal=0,discount=0,total=0,couponCode='',config=null,csrf='',submitting=false;

function slugs(){
  if(params.get('cart')==='1')return [...new Set((read('bwa_cart',[])||[]).filter(Boolean).map(String))];
  return [params.get('course')||'python'];
}
function message(text,type=''){
  const el=$('#checkoutMessage');if(!el)return;el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type);
}
function couponMessage(text,type=''){
  const el=$('#checkoutCouponMessage');if(!el)return;el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type);
}
function setSubmit(enabled,label){const btn=$('#checkoutSubmit');if(!btn)return;btn.disabled=!enabled;btn.textContent=label}
async function session(){
  const r=await fetch('/api/session?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
  const out=await r.json().catch(()=>({}));csrf=out.csrf_token||'';return out;
}
async function api(path,{method='GET',body=null}={}){
  if(!csrf&&method!=='GET')await session();
  const headers={Accept:'application/json','X-Requested-With':'XMLHttpRequest'};
  if(body!==null){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-TOKEN']=csrf}
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers,body:body!==null?JSON.stringify(body):undefined});
  const out=await r.json().catch(()=>({}));
  if(!r.ok){const text=out?.errors?Object.values(out.errors).flat().join(' '):(out?.message||`Request failed (${r.status})`);const e=new Error(text);e.data=out;throw e}
  return out;
}
async function getCourse(slug){return api(`/api/courses/${encodeURIComponent(slug)}`)}
async function getPaymentConfig(){
  const r=await fetch('/api/payment/sadapay?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
  const out=await r.json().catch(()=>({enabled:false}));if(!r.ok)throw new Error(out.message||'Could not load SadaPay details.');return out;
}

function renderOrder(){
  const list=$('#checkoutItems');
  if(list)list.innerHTML=courses.map(c=>`<article class="checkout-item">${c.image?`<img src="${esc(c.image)}" alt="">`:'<span class="admin-course-placeholder">AWK</span>'}<div class="checkout-item-copy"><b>${esc(c.title||'Course')}</b><span>${esc(c.category||'Paid course')}</span><strong>${money(c.price)}</strong></div></article>`).join('')||'<p class="checkout-loading">No course selected.</p>';
  $('#checkoutSubtotal').textContent=money(subtotal);
  $('#checkoutTotal').textContent=money(total);
  $('#sadapayAmount').textContent=money(total);
  const row=$('#checkoutDiscountRow');
  if(row){row.hidden=discount<=0;$('#checkoutDiscount').textContent=`− ${money(discount)}`}
  updateSubmit();
}

function renderConfig(){
  const status=$('#sadapayConfigStatus'),number=$('#sadapayAccountNumber'),img=$('#sadapayQrImage'),missing=$('#sadapayQrMissing');
  const account=config?.account_number||'';
  if(number)number.textContent=account||'Not configured';
  if(config?.qr_url){
    if(img){img.src=config.qr_url+(config.qr_url.includes('?')?'&':'?')+'t='+Date.now();img.hidden=false}
    if(missing)missing.hidden=true;
  }else{
    if(img){img.hidden=true;img.removeAttribute('src')}
    if(missing){missing.hidden=false;missing.textContent='SadaPay QR has not been uploaded yet.'}
  }
  if(status){status.textContent=config?.enabled?'Ready':'Not configured';status.style.color=config?.enabled?'#c8f596':'#ff9ea4'}
  updateSubmit();
}

function updateSubmit(){
  if(!courses.length){setSubmit(false,'Course unavailable');return}
  if(total<=0){setSubmit(true,'Complete free enrollment');return}
  if(!config?.enabled){setSubmit(false,'SadaPay details not configured');return}
  setSubmit(true,`Submit payment for verification · ${money(total)}`);
}

async function applyCoupon(){
  const input=$('#checkoutCouponCode'),code=String(input?.value||'').trim();
  if(!code){couponCode='';discount=0;total=subtotal;couponMessage('Coupon removed. Standard course price restored.');renderOrder();return}
  const btn=$('#checkoutApplyCoupon');if(btn){btn.disabled=true;btn.textContent='Checking…'}
  couponMessage('Checking coupon…');
  try{
    const out=await api('/api/coupons/quote',{method:'POST',body:{course_slugs:slugs(),coupon_code:code}});
    couponCode=out.coupon?.code||code.toUpperCase();discount=Number(out.discount_total||0);total=Number(out.total??Math.max(0,subtotal-discount));
    if(input)input.value=couponCode;
    couponMessage(`${couponCode} applied successfully. You saved ${money(discount)}.`,'success');renderOrder();
  }catch(e){couponCode='';discount=0;total=subtotal;couponMessage(e.message||'Coupon could not be applied.','error');renderOrder()}
  finally{if(btn){btn.disabled=false;btn.textContent='Apply'}}
}

function pendingView(out,reference){
  const form=$('#sadapayCheckoutForm');if(!form)return;
  const number=out?.order?.number||'—';
  form.innerHTML=`<section class="manual-payment-pending"><div class="pending-icon">✓</div><p class="eyebrow">PAYMENT SUBMITTED</p><h2>${out.payment_pending?'Awaiting payment verification':'Enrollment completed'}</h2><p>${out.payment_pending?'Your SadaPay payment has been submitted. Course access will be granted after an administrator verifies the payment.':'Your order was completed successfully and course access is active.'}</p><dl><div><dt>Order</dt><dd>${esc(number)}</dd></div>${reference?`<div><dt>Reference</dt><dd>${esc(reference)}</dd></div>`:''}<div><dt>Amount</dt><dd>${money(out?.total||0)}</dd></div><div><dt>Status</dt><dd>${out.payment_pending?'Pending verification':'Completed'}</dd></div></dl><a class="checkout-button pending-orders-link" href="${out.payment_pending?'/orders':'/my-learning'}">${out.payment_pending?'View my orders':'Open my learning'}</a></section>`;
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submit(e){
  e.preventDefault();if(submitting)return;
  const reference=String($('#sadapayReference')?.value||'').trim();
  if(total>0&&!config?.enabled){message('SadaPay account details are not configured. Please contact support.','error');return}
  if(total>0&&reference.length<4){message('Enter your SadaPay transaction/reference ID after making payment.','error');$('#sadapayReference')?.focus();return}
  submitting=true;setSubmit(false,'Submitting…');message('Submitting your payment for verification…');
  try{
    const out=await api('/api/checkout/sadapay',{method:'POST',body:{course_slugs:slugs(),coupon_code:couponCode||null,payment_reference:reference||null}});
    const order={number:out.order?.number,total:Number(out.total||out.order?.total||0),date:out.order?.created_at,ids:slugs(),status:out.status||out.order?.status||'pending',payment_method:'sadapay',payment_reference:reference||null,originalTotal:Number(out.subtotal||subtotal),discount:couponCode?{code:couponCode,amount:Number(out.discount_total||discount)}:null};
    write('bwa_last_order',order);write('bwa_orders',[order,...(read('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);write('bwa_cart',[]);remove('bwa_pending_discount');remove('bwa_apply_discount_on_success');
    pendingView(out,reference);
  }catch(err){message(err.message||'Payment could not be submitted.','error');updateSubmit()}
  finally{submitting=false}
}

async function init(){
  $('#checkoutApplyCoupon')?.addEventListener('click',applyCoupon);
  $('#checkoutCouponCode')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoupon()}});
  $('#sadapayCheckoutForm')?.addEventListener('submit',submit);
  try{await session()}catch{}
  const requested=slugs();
  if(!requested.length){message('Your cart is empty. Add a course before checking out.','error');setSubmit(false,'Cart is empty');return}
  try{
    courses=(await Promise.all(requested.map(s=>getCourse(s).catch(()=>null)))).filter(Boolean);
    if(courses.length!==requested.length)message('One or more selected courses are currently unavailable.','error');
    subtotal=courses.reduce((sum,c)=>sum+Number(c.price||0),0);total=subtotal;renderOrder();
  }catch(e){message(e.message||'Unable to load your order.','error');setSubmit(false,'Course unavailable')}
  try{config=await getPaymentConfig();renderConfig()}catch(e){config={enabled:false};renderConfig();message(e.message||'SadaPay details could not be loaded.','error')}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
