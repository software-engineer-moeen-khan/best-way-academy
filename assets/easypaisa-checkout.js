(()=>{
'use strict';
const $=s=>document.querySelector(s);
const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const remove=k=>localStorage.removeItem(k);
let quote=null,config=null,submitting=false;

function slugs(){const p=new URLSearchParams(location.search);return p.get('cart')==='1'?[...new Set((read('bwa_cart',[])||[]).filter(Boolean).map(String))]:[p.get('course')||'python']}
function message(text,type=''){const el=$('#checkoutMessage');if(!el)return;el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type)}
function setSubmit(enabled,label){const btn=$('#checkoutSubmit');if(!btn)return;btn.disabled=!enabled;btn.textContent=label}
async function bridge(){for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)throw new Error('Payment service is still loading.');await window.BWABackend.ready;if(!window.BWABackend.available)throw new Error('Payment service is unavailable.');if(!window.BWABackend.user)throw new Error('Please sign in before submitting payment.');return window.BWABackend}
async function paymentConfig(force=false){if(config&&!force)return config;const r=await fetch('/api/payment/easypaisa?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});config=await r.json().catch(()=>({enabled:false}));return config}

function resetPayment(){
  quote=null;
  const panel=$('#easypaisaPanel'),img=$('#easypaisaQrImage'),missing=$('#easypaisaQrMissing'),ref=$('#easypaisaReference');
  if(panel)panel.hidden=true;if(img){img.hidden=true;img.removeAttribute('src')}if(missing)missing.hidden=true;if(ref)ref.value='';
  setSubmit(false,'Apply coupon to continue');
}

async function revealQr(detail){
  quote=detail||null;
  const panel=$('#easypaisaPanel'),img=$('#easypaisaQrImage'),missing=$('#easypaisaQrMissing'),amount=$('#easypaisaAmount'),radio=$('input[name=payment][value=easypaisa]');
  if(radio)radio.checked=true;
  if(amount)amount.textContent=money(detail?.total||0);

  if(Number(detail?.total||0)<=0){
    if(panel)panel.hidden=true;
    setSubmit(true,'Complete free enrollment');
    message('Coupon applied. Your payable amount is Rs 0; no EasyPaisa payment is required.','success');
    return;
  }

  const cfg=await paymentConfig(true).catch(()=>({enabled:false}));
  if(panel)panel.hidden=false;
  if(cfg.enabled&&cfg.qr_url){
    if(img){img.src=cfg.qr_url+(cfg.qr_url.includes('?')?'&':'?')+'t='+Date.now();img.hidden=false}
    if(missing)missing.hidden=true;
    setSubmit(true,`Submit payment for verification · ${money(detail.total)}`);
    message('Coupon applied. Scan the EasyPaisa QR and submit your transaction reference.','success');
    panel?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }else{
    if(img){img.hidden=true;img.removeAttribute('src')}if(missing)missing.hidden=false;
    setSubmit(false,'EasyPaisa QR not configured');
    message('EasyPaisa QR is not configured yet. Please contact the academy administrator.','error');
  }
}

function pendingView(out,reference){
  const form=$('#checkoutForm');if(!form)return;
  const number=out?.order?.number||'—';
  form.innerHTML=`<section class="manual-payment-pending"><div class="pending-icon">✓</div><p class="eyebrow">PAYMENT SUBMITTED</p><h2>Awaiting payment verification</h2><p>Your EasyPaisa payment reference has been submitted. Course access will be granted after an administrator verifies the payment.</p><dl><div><dt>Order</dt><dd>${String(number).replace(/[<>]/g,'')}</dd></div><div><dt>Reference</dt><dd>${String(reference).replace(/[<>]/g,'')}</dd></div><div><dt>Amount</dt><dd>${money(out?.total||0)}</dd></div><div><dt>Status</dt><dd>Pending verification</dd></div></dl><a class="checkout-button pending-orders-link" href="/orders">View my orders</a></section>`;
  const panel=$('#easypaisaPanel');if(panel)panel.hidden=true;
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submitEasyPaisa(e){
  const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='checkoutForm')return;
  const selected=$('input[name=payment]:checked')?.value;
  if(selected!=='easypaisa')return;

  // A 100% coupon needs no manual payment; let the standard checkout endpoint grant access.
  if(quote&&Number(quote.total||0)<=0)return;

  e.preventDefault();e.stopImmediatePropagation();
  if(submitting)return;
  const pending=read('bwa_pending_discount',null),reference=$('#easypaisaReference')?.value.trim()||'';
  if(!quote||!pending?.code){message('Apply a valid coupon before submitting EasyPaisa payment.','error');return}
  if(reference.length<4){message('Enter the EasyPaisa transaction/reference ID after sending payment.','error');$('#easypaisaReference')?.focus();return}
  submitting=true;setSubmit(false,'Submitting for verification…');message('Submitting your payment reference securely…');
  try{
    const b=await bridge();
    const out=await b.api('/api/checkout/easypaisa',{method:'POST',body:JSON.stringify({course_slugs:slugs(),coupon_code:pending.code,payment_reference:reference})});
    const order={number:out.order?.number,total:Number(out.total||out.order?.total||0),date:out.order?.created_at,ids:slugs(),status:out.status||out.order?.status||'pending',payment_method:'easypaisa',payment_reference:reference,originalTotal:Number(out.subtotal||0),discount:{code:pending.code,amount:Number(out.discount_total||0)}};
    write('bwa_last_order',order);write('bwa_orders',[order,...(read('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);write('bwa_cart',[]);remove('bwa_pending_discount');remove('bwa_apply_discount_on_success');
    if(out.payment_pending){pendingView(out,reference)}else{location.href='/my-learning'}
  }catch(err){const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Payment could not be submitted.');message(text,'error');setSubmit(true,`Submit payment for verification · ${money(quote?.total||0)}`)}
  finally{submitting=false}
}

document.addEventListener('submit',submitEasyPaisa,true);
document.addEventListener('bwa:coupon-applied',e=>revealQr(e.detail));
document.addEventListener('bwa:coupon-reset',resetPayment);
document.addEventListener('DOMContentLoaded',()=>{
  const radio=$('input[name=payment][value=easypaisa]');if(radio)radio.checked=true;
  resetPayment();
});
})();
