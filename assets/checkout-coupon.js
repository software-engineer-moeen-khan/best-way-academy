(()=>{
'use strict';
const $=s=>document.querySelector(s);
const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const remove=k=>localStorage.removeItem(k);
let appliedCode='';

function requestedSlugs(){
  const p=new URLSearchParams(location.search);
  if(p.get('cart')==='1')return [...new Set((read('bwa_cart',[])||[]).filter(Boolean).map(String))];
  return [p.get('course')||'python'];
}

function subtotalFromPage(){
  const raw=$('#checkoutSubtotal')?.textContent||'0';
  return Number(raw.replace(/[^0-9.-]/g,''))||0;
}

function setMessage(text,type=''){
  const el=$('#checkoutCouponMessage');if(!el)return;
  el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type);
}

function setSubmitMessage(text,type=''){
  const el=$('#checkoutMessage');if(!el)return;
  el.textContent=text||'';el.classList.remove('success','error');if(type)el.classList.add(type);
}

function emit(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}

function resetQuote(){
  const subtotal=subtotalFromPage(),row=$('#checkoutDiscountRow');
  if(row)row.hidden=true;
  const amount=$('#checkoutDiscount');if(amount)amount.textContent='− Rs 0';
  const total=$('#checkoutTotal');if(total)total.textContent=money(subtotal);
  const button=$('#checkoutSubmit');if(button&&!button.disabled)button.textContent=`Complete enrollment · ${money(subtotal)}`;
  appliedCode='';remove('bwa_pending_discount');
  emit('bwa:coupon-reset',{subtotal,total:subtotal});
}

async function backend(){
  for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Checkout service is still loading. Please try again.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Checkout service is unavailable. Please refresh and try again.');
  if(!window.BWABackend.user)throw new Error('Please sign in before applying a coupon.');
  return window.BWABackend;
}

async function waitForOrder(){
  for(let i=0;i<100;i++){
    const loading=$('#checkoutItems .checkout-loading');
    const button=$('#checkoutSubmit');
    if(!loading&&button&&!button.disabled)return true;
    await new Promise(r=>setTimeout(r,50));
  }
  return false;
}

async function applyCoupon(code,quiet=false){
  const input=$('#checkoutCouponCode'),button=$('#checkoutApplyCoupon');
  code=String(code||input?.value||'').trim().toUpperCase();
  if(input)input.value=code;
  if(!code){resetQuote();setMessage('Enter a coupon code.','error');return;}
  const slugs=requestedSlugs();
  if(!slugs.length){resetQuote();setMessage('Your cart is empty.','error');return;}
  if(button){button.disabled=true;button.textContent='Checking…'}
  setSubmitMessage('');
  if(!quiet)setMessage('Validating coupon with the server…');
  try{
    const bridge=await backend();
    const out=await bridge.api('/api/coupons/quote',{method:'POST',body:JSON.stringify({course_slugs:slugs,coupon_code:code})});
    const coupon=out.coupon||{},discount=Number(out.discount_total||0),total=Number(out.total||0),subtotal=Number(out.subtotal||0);
    const sub=$('#checkoutSubtotal');if(sub)sub.textContent=money(subtotal);
    const discountRow=$('#checkoutDiscountRow');if(discountRow)discountRow.hidden=false;
    const discountAmount=$('#checkoutDiscount');if(discountAmount)discountAmount.textContent=`− ${money(discount)}`;
    const totalEl=$('#checkoutTotal');if(totalEl)totalEl.textContent=money(total);
    const submit=$('#checkoutSubmit');if(submit&&!submit.disabled)submit.textContent=`Complete enrollment · ${money(total)}`;
    appliedCode=String(coupon.code||code).toUpperCase();
    write('bwa_pending_discount',{code:appliedCode});
    const detail=coupon.applies_to&&coupon.applies_to!=='Entire order'?` Applies to ${coupon.applies_to}.`:'';
    setMessage(`${appliedCode} applied. You save ${money(discount)}.${detail}`,'success');
    emit('bwa:coupon-applied',{code:appliedCode,subtotal,discount,total,coupon,course_slugs:slugs});
  }catch(err){
    resetQuote();
    const text=err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Coupon could not be applied.');
    setMessage(text,'error');
  }finally{
    if(button){button.disabled=false;button.textContent=appliedCode?'Applied':'Apply'}
  }
}

async function init(){
  if(location.pathname!=='/checkout'&&!document.body.classList.contains('checkout-page'))return;
  const input=$('#checkoutCouponCode'),button=$('#checkoutApplyCoupon');
  if(!input||!button)return;
  button.disabled=true;
  await waitForOrder();
  button.disabled=false;
  input.addEventListener('input',()=>{
    input.value=input.value.toUpperCase();
    if(appliedCode&&input.value.trim().toUpperCase()!==appliedCode){resetQuote();setMessage('Coupon changed. Press Apply to validate the new code.');}
    else if(!input.value.trim()){resetQuote();setMessage('');}
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoupon(input.value)}});
  button.addEventListener('click',()=>applyCoupon(input.value));
  const pending=read('bwa_pending_discount',null)?.code;
  if(pending){input.value=String(pending).toUpperCase();await applyCoupon(pending,true)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();