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
async function bridge(){for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)throw new Error('Payment service is still loading.');await window.BWABackend.ready;if(!window.BWABackend.available)throw new Error('Payment service is unavailable.');if(!window.BWABackend.user)throw new Error('Please sign in before submitting payment.');return window.BWABackend}
async function paymentConfig(){if(config)return config;const r=await fetch('/api/payment/easypaisa',{credentials:'same-origin',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});config=await r.json().catch(()=>({enabled:false}));return config}

function selectMethod(){const radio=$('input[name=payment][value=easypaisa]');if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}))}}
function hideQr(){const panel=$('#easypaisaPanel'),option=$('#easypaisaMethodOption');if(panel)panel.hidden=true;if(option)option.hidden=true;quote=null;const radio=$('input[name=payment][value=card]');if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}))}}
async function revealQr(detail){
  quote=detail||null;
  const panel=$('#easypaisaPanel'),option=$('#easypaisaMethodOption'),img=$('#easypaisaQrImage'),missing=$('#easypaisaQrMissing'),amount=$('#easypaisaAmount');
  if(!panel||!option)return;
  if(amount)amount.textContent=money(detail?.total||0);
  if(Number(detail?.total||0)<=0){hideQr();message('Your coupon covers the full order. No EasyPaisa payment is required.','success');return}
  const cfg=await paymentConfig().catch(()=>({enabled:false}));
  panel.hidden=false;
  if(cfg.enabled&&cfg.qr_url){
    option.hidden=false;if(img){img.src=cfg.qr_url+'?t='+Date.now();img.hidden=false}if(missing)missing.hidden=true;selectMethod();
    const submit=$('#checkoutSubmit');if(submit)submit.textContent=`Submit payment for verification · ${money(detail.total)}`;
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }else{
    option.hidden=true;if(img)img.hidden=true;if(missing)missing.hidden=false;
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
  const selected=$('input[name=payment]:checked')?.value;
  if(selected!=='easypaisa')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(submitting)return;
  const pending=read('bwa_pending_discount',null),reference=$('#easypaisaReference')?.value.trim()||'';
  if(!quote||!pending?.code){message('Apply a valid coupon before using EasyPaisa QR payment.','error');return}
  if(reference.length<4){message('Enter the EasyPaisa transaction/reference ID after sending payment.','error');$('#easypaisaReference')?.focus();return}
  submitting=true;const submit=$('#checkoutSubmit');if(submit){submit.disabled=true;submit.textContent='Submitting for verification…'}message('Submitting your payment reference securely…');
  try{
    const b=await bridge();
    const out=await b.api('/api/checkout/easypaisa',{method:'POST',body:JSON.stringify({course_slugs:slugs(),coupon_code:pending.code,payment_reference:reference})});
    const order={number:out.order?.number,total:Number(out.total||out.order?.total||0),date:out.order?.created_at,ids:slugs(),status:out.status||out.order?.status||'pending',payment_method:'easypaisa',payment_reference:reference,originalTotal:Number(out.subtotal||0),discount:{code:pending.code,amount:Number(out.discount_total||0)}};
    write('bwa_last_order',order);write('bwa_orders',[order,...(read('bwa_orders',[])||[]).filter(x=>x.number!==order.number)]);write('bwa_cart',[]);remove('bwa_pending_discount');remove('bwa_apply_discount_on_success');
    if(out.payment_pending){pendingView(out,reference)}else{location.href='/my-learning'}
  }catch(err){const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Payment could not be submitted.');message(text,'error');if(submit){submit.disabled=false;submit.textContent=`Submit payment for verification · ${money(quote?.total||0)}`}}
  finally{submitting=false}
}

document.addEventListener('submit',submitEasyPaisa,true);
document.addEventListener('bwa:coupon-applied',e=>revealQr(e.detail));
document.addEventListener('bwa:coupon-reset',hideQr);
document.addEventListener('change',e=>{const radio=e.target instanceof HTMLInputElement&&e.target.name==='payment'?e.target:null;if(!radio)return;const fields=$('#cardFields');if(fields)fields.hidden=radio.value!=='card';const panel=$('#easypaisaPanel');if(panel&&quote&&config?.enabled)panel.hidden=radio.value!=='easypaisa';const submit=$('#checkoutSubmit');if(submit&&quote&&radio.value==='easypaisa')submit.textContent=`Submit payment for verification · ${money(quote.total||0)}`});
})();