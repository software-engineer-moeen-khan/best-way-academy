(()=>{
'use strict';
const $=s=>document.querySelector(s);
const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const remove=k=>localStorage.removeItem(k);
let quote=null,config=null,submitting=false;

function slugs(){const p=new URLSearchParams(location.search);return p.get('cart')==='1'?[...new Set((read('bwa_cart',[])||[]).filter(Boolean).map(String))]:[p.get('course')||'beginner-trading']}
function amountFromPage(){return Number(($('#checkoutTotal')?.textContent||'0').replace(/[^0-9.-]/g,''))||0}
function message(text,type=''){const el=$('#checkoutMessage');if(!el)return;el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type)}
function setSubmit(enabled,label){const btn=$('#checkoutSubmit');if(!btn)return;btn.disabled=!enabled;btn.textContent=label}
async function bridge(){for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)throw new Error('Payment service is still loading.');await window.BWABackend.ready;if(!window.BWABackend.available)throw new Error('Payment service is unavailable.');if(!window.BWABackend.user)throw new Error('Please sign in before submitting payment.');return window.BWABackend}
async function paymentConfig(force=false){if(config&&!force)return config;const r=await fetch('/api/payment/sadapay?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});config=await r.json().catch(()=>({enabled:false}));if(!r.ok)throw new Error(config.message||'SadaPay settings could not be loaded.');return config}

async function showPayment(detail){
  quote=detail||{subtotal:amountFromPage(),discount:0,total:amountFromPage(),code:null};
  const panel=$('#sadapayPanel'),amount=$('#sadapayAmount'),img=$('#sadapayQrImage'),name=$('#sadapayAccountName'),number=$('#sadapayAccountNumber'),radio=$('input[name=payment][value=sadapay]');
  if(radio)radio.checked=true;if(amount)amount.textContent=money(quote.total||0);
  try{
    const cfg=await paymentConfig();
    if(name)name.textContent=cfg.account_name||'Muhammad Hamid Khan';
    if(number)number.textContent=cfg.account_number||'03104720458';
    if(img){img.src=(cfg.qr_url||'/assets/sadapay-account-qr.svg')+((cfg.qr_url||'').includes('?')?'&':'?')+'t='+Date.now();img.hidden=false}
    if(panel)panel.hidden=false;
    if(Number(quote.total||0)<=0){setSubmit(true,'Complete free enrollment');message('Your final payable amount is Rs 0. Submit to activate access.','success')}
    else{setSubmit(true,`Submit SadaPay payment · ${money(quote.total)}`);message(quote.code?'Coupon applied. Send the exact amount through SadaPay and enter the transaction reference.':'Send the exact amount through SadaPay, or apply a coupon first if you have one.','success')}
  }catch(err){setSubmit(false,'SadaPay unavailable');message(err.message||'SadaPay settings could not be loaded.','error')}
}

function pendingView(out,reference){
  const form=$('#checkoutForm');if(!form)return;
  const number=out?.order?.number||'—';
  form.innerHTML=`<section class="manual-payment-pending"><div class="pending-icon">✓</div><p class="eyebrow">PAYMENT SUBMITTED</p><h2>Awaiting SadaPay verification</h2><p>Your payment reference has been submitted. Course access will be granted after an administrator verifies the payment.</p><dl><div><dt>Order</dt><dd>${String(number).replace(/[<>]/g,'')}</dd></div><div><dt>Reference</dt><dd>${String(reference).replace(/[<>]/g,'')}</dd></div><div><dt>Amount</dt><dd>${money(out?.total||0)}</dd></div><div><dt>Status</dt><dd>Pending verification</dd></div></dl><a class="checkout-button pending-orders-link" href="/orders">View my orders</a></section>`;
  const panel=$('#sadapayPanel');if(panel)panel.hidden=true;window.scrollTo({top:0,behavior:'smooth'});
}

async function submitSadapay(e){
  const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='checkoutForm')return;
  const selected=$('input[name=payment]:checked')?.value;if(selected!=='sadapay')return;
  e.preventDefault();e.stopImmediatePropagation();if(submitting)return;
  const pending=read('bwa_pending_discount',null),total=Number(quote?.total??amountFromPage()),refInput=$('#sadapayReference');
  const reference=total<=0?`FREE-${Date.now()}`:(refInput?.value.trim()||'');
  if(total>0&&reference.length<4){message('Enter the SadaPay transaction/reference ID after sending payment.','error');refInput?.focus();return}
  submitting=true;setSubmit(false,'Submitting for verification…');message('Submitting your SadaPay payment reference securely…');
  try{
    const b=await bridge();
    const out=await b.api('/api/checkout/sadapay',{method:'POST',body:JSON.stringify({course_slugs:slugs(),coupon_code:pending?.code||null,payment_reference:reference})});
    const order={number:out.order?.number,total:Number(out.total||out.order?.total||0),date:out.order?.created_at,ids:slugs(),status:out.status||out.order?.status||'pending',payment_method:'sadapay',payment_reference:reference,originalTotal:Number(out.subtotal||0),discount:out.coupon_code?{code:out.coupon_code,amount:Number(out.discount_total||0)}:null};
    write('bwa_last_order',order);write('bwa_orders',[order,...(read('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);write('bwa_cart',[]);remove('bwa_pending_discount');remove('bwa_apply_discount_on_success');
    if(out.payment_pending)pendingView(out,reference);else location.href='/my-learning';
  }catch(err){const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Payment could not be submitted.');message(text,'error');setSubmit(true,total<=0?'Complete free enrollment':`Submit SadaPay payment · ${money(total)}`)}
  finally{submitting=false}
}

async function init(){
  const radio=$('input[name=payment][value=sadapay]');if(radio)radio.checked=true;
  for(let i=0;i<120;i++){if(!$('#checkoutItems .checkout-loading'))break;await new Promise(r=>setTimeout(r,50))}
  await showPayment({subtotal:amountFromPage(),discount:0,total:amountFromPage(),code:null});
}
document.addEventListener('submit',submitSadapay,true);
document.addEventListener('bwa:coupon-applied',e=>showPayment({...e.detail,code:e.detail?.code||null}));
document.addEventListener('bwa:coupon-reset',e=>showPayment({subtotal:e.detail?.subtotal||amountFromPage(),discount:0,total:e.detail?.total||amountFromPage(),code:null}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
