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
function amountFromPage(){const raw=$('#checkoutTotal')?.textContent||$('#checkoutSubtotal')?.textContent||'0';return Number(String(raw).replace(/[^0-9.-]/g,''))||0}
async function bridge(){for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)throw new Error('Payment service is still loading.');await window.BWABackend.ready;if(!window.BWABackend.available)throw new Error('Payment service is unavailable.');if(!window.BWABackend.user)throw new Error('Please sign in before submitting payment.');return window.BWABackend}
async function paymentConfig(force=false){if(config&&!force)return config;const r=await fetch('/api/payment/easypaisa?ts='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});config=await r.json().catch(()=>({enabled:false}));return config}

async function waitForCheckoutTotal(){
  for(let i=0;i<120;i++){
    const loading=$('#checkoutItems .checkout-loading');
    const item=$('#checkoutItems .checkout-item');
    if(!loading&&item)return true;
    await new Promise(r=>setTimeout(r,50));
  }
  return false;
}

async function revealQr(detail={},couponApplied=false){
  const total=Number(detail?.total??amountFromPage()??0);
  quote={subtotal:Number(detail?.subtotal??total),discount:Number(detail?.discount??0),total,code:detail?.code||null};
  const panel=$('#easypaisaPanel'),img=$('#easypaisaQrImage'),missing=$('#easypaisaQrMissing'),amount=$('#easypaisaAmount'),radio=$('input[name=payment][value=easypaisa]');
  if(radio)radio.checked=true;
  if(amount)amount.textContent=money(total);

  if(total<=0){
    if(panel)panel.hidden=true;
    setSubmit(true,'Complete free enrollment');
    message(couponApplied?'Coupon applied. Your payable amount is Rs 0; no EasyPaisa payment is required.':'No payment is required for this order.','success');
    return;
  }

  const cfg=await paymentConfig(true).catch(()=>({enabled:false}));
  if(panel)panel.hidden=false;
  if(cfg.enabled&&cfg.qr_url){
    if(img){img.src=cfg.qr_url+(cfg.qr_url.includes('?')?'&':'?')+'t='+Date.now();img.hidden=false}
    if(missing)missing.hidden=true;
    setSubmit(true,`Submit payment for verification · ${money(total)}`);
    message(couponApplied?'Coupon applied. Scan the EasyPaisa QR and submit your transaction reference.':'Scan the EasyPaisa QR, pay the amount shown, then enter your transaction/reference ID.','success');
  }else{
    if(img){img.hidden=true;img.removeAttribute('src')}if(missing)missing.hidden=false;
    setSubmit(false,'EasyPaisa QR not configured');
    message('EasyPaisa QR is not configured yet. Please contact the academy administrator.','error');
  }
}

async function showBaseQr(){
  const total=amountFromPage();
  const discountRow=$('#checkoutDiscountRow');
  const hasDiscount=discountRow&&!discountRow.hidden;
  if(hasDiscount)return;
  await revealQr({subtotal:total,discount:0,total,code:null},false);
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

  // A zero-payable order needs no manual payment; let the standard checkout endpoint grant access.
  if(quote&&Number(quote.total||0)<=0)return;

  e.preventDefault();e.stopImmediatePropagation();
  if(submitting)return;
  const pending=read('bwa_pending_discount',null),reference=$('#easypaisaReference')?.value.trim()||'';
  if(!quote){message('Payment details are still loading. Please try again in a moment.','error');return}
  if(reference.length<4){message('Enter the EasyPaisa transaction/reference ID after sending payment.','error');$('#easypaisaReference')?.focus();return}
  submitting=true;setSubmit(false,'Submitting for verification…');message('Submitting your payment reference securely…');
  try{
    const b=await bridge();
    const out=await b.api('/api/checkout/easypaisa',{method:'POST',body:JSON.stringify({course_slugs:slugs(),coupon_code:pending?.code||null,payment_reference:reference})});
    const order={number:out.order?.number,total:Number(out.total||out.order?.total||0),date:out.order?.created_at,ids:slugs(),status:out.status||out.order?.status||'pending',payment_method:'easypaisa',payment_reference:reference,originalTotal:Number(out.subtotal||0),discount:pending?.code?{code:pending.code,amount:Number(out.discount_total||0)}:null};
    write('bwa_last_order',order);write('bwa_orders',[order,...(read('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);write('bwa_cart',[]);remove('bwa_pending_discount');remove('bwa_apply_discount_on_success');
    if(out.payment_pending){pendingView(out,reference)}else{location.href='/my-learning'}
  }catch(err){const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Payment could not be submitted.');message(text,'error');setSubmit(true,`Submit payment for verification · ${money(quote?.total||0)}`)}
  finally{submitting=false}
}

document.addEventListener('submit',submitEasyPaisa,true);
document.addEventListener('bwa:coupon-applied',e=>revealQr(e.detail,true));
document.addEventListener('bwa:coupon-reset',()=>setTimeout(showBaseQr,0));
document.addEventListener('DOMContentLoaded',async()=>{
  const radio=$('input[name=payment][value=easypaisa]');if(radio)radio.checked=true;
  setSubmit(false,'Loading EasyPaisa QR…');
  await waitForCheckoutTotal();
  await showBaseQr();
});
})();
