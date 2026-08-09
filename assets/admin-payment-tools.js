(()=>{
'use strict';
const $=s=>document.querySelector(s);
let bridge=null,orders=[];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function ready(){for(let i=0;i<100&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));if(!window.BWABackend)return null;await window.BWABackend.ready;if(!window.BWABackend.available||window.BWABackend.user?.role!=='admin')return null;bridge=window.BWABackend;return bridge}
function toast(text,error=false){const el=$('#adminToast');if(!el)return;el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800)}
function meta(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)||{}}catch{return{}}}

function installCard(){
  const panel=document.querySelector('.admin-section[data-panel="settings"]');if(!panel||$('#adminPaymentQrCard'))return;
  const card=document.createElement('section');card.id='adminPaymentQrCard';card.className='admin-card admin-payment-card';card.innerHTML=`<div class="admin-card-head"><div><h2>EasyPaisa payment QR</h2><p>Shown to learners after a valid coupon is applied.</p></div><span id="adminPaymentQrStatus" class="status-pill status-pending">Checking</span></div><div class="admin-payment-body"><div class="admin-payment-preview"><img id="adminPaymentQrPreview" alt="EasyPaisa payment QR" hidden><div id="adminPaymentQrEmpty">No QR uploaded yet.</div></div><div class="admin-payment-controls"><p>Upload the official EasyPaisa QR image. Learners will scan this image, send the discounted amount and submit their transaction reference for verification.</p><label class="admin-payment-file">QR image<input id="adminPaymentQrFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="admin-actions"><button id="adminPaymentQrUpload" type="button" class="admin-primary">Upload / Replace QR</button><button id="adminPaymentQrRemove" type="button" class="admin-danger">Remove QR</button></div><small>Accepted: JPG, PNG or WebP · maximum 5 MB.</small></div></div>`;
  const settings=$('#adminSettingsForm');settings?.insertAdjacentElement('afterend',card);
  $('#adminPaymentQrUpload')?.addEventListener('click',upload);
  $('#adminPaymentQrRemove')?.addEventListener('click',removeQr);
}
async function loadConfig(){
  try{const r=await fetch('/api/payment/easypaisa',{credentials:'same-origin',headers:{Accept:'application/json'}});const c=await r.json();const status=$('#adminPaymentQrStatus'),img=$('#adminPaymentQrPreview'),empty=$('#adminPaymentQrEmpty'),remove=$('#adminPaymentQrRemove');if(status){status.textContent=c.enabled?'Active':'Not configured';status.className='status-pill '+(c.enabled?'status-active':'status-pending')}if(c.enabled&&c.qr_url){if(img){img.src=c.qr_url+'?t='+Date.now();img.hidden=false}if(empty)empty.hidden=true;if(remove)remove.disabled=false}else{if(img)img.hidden=true;if(empty)empty.hidden=false;if(remove)remove.disabled=true}}catch{toast('Could not load EasyPaisa QR settings.',true)}}
async function upload(){const input=$('#adminPaymentQrFile'),file=input?.files?.[0];if(!file){toast('Choose the EasyPaisa QR image first.',true);return}if(file.size>5*1024*1024){toast('QR image must be 5 MB or smaller.',true);return}const fd=new FormData();fd.append('qr',file);const btn=$('#adminPaymentQrUpload');if(btn){btn.disabled=true;btn.textContent='Uploading…'}try{await bridge.api('/api/admin/manage/payment/easypaisa-qr',{method:'POST',body:fd});toast('EasyPaisa QR updated.');input.value='';await loadConfig()}catch(e){toast(e?.data?.errors?Object.values(e.data.errors).flat().join(' '):(e.message||'QR upload failed.'),true)}finally{if(btn){btn.disabled=false;btn.textContent='Upload / Replace QR'}}}
async function removeQr(){if(!confirm('Remove the EasyPaisa payment QR? Learners will not be able to submit QR payments until another QR is uploaded.'))return;try{await bridge.api('/api/admin/manage/payment/easypaisa-qr',{method:'DELETE'});toast('EasyPaisa QR removed.');await loadConfig()}catch(e){toast(e.message||'Could not remove QR.',true)}}

async function loadOrderMeta(){try{const out=await bridge.api('/api/admin/manage/workspace');orders=out.orders||[];decorateOrders()}catch{}}
function decorateOrders(){
  const rows=[...document.querySelectorAll('#adminOrdersBody tr')];
  rows.forEach(row=>{const number=row.querySelector('td:first-child strong')?.textContent?.trim();if(!number)return;const order=orders.find(o=>String(o.number)===number);if(!order)return;const m=meta(order.metadata);if(order.payment_method!=='easypaisa'&&!m.payment_reference)return;const cell=row.children[3];if(!cell||cell.querySelector('.admin-payment-reference'))return;const ref=esc(m.payment_reference||'Not supplied');cell.insertAdjacentHTML('beforeend',`<small class="admin-payment-reference"><b>Ref:</b> ${ref}</small>${m.payment_submitted_at?`<small class="admin-payment-reference">Submitted: ${esc(new Date(m.payment_submitted_at).toLocaleString('en-PK'))}</small>`:''}`)});
}

async function init(){if(!await ready())return;installCard();injectCss();await loadConfig();await loadOrderMeta();const body=$('#adminOrdersBody');if(body)new MutationObserver(()=>decorateOrders()).observe(body,{childList:true,subtree:true});$('#adminRefresh')?.addEventListener('click',()=>setTimeout(loadOrderMeta,700))}
function injectCss(){if(document.querySelector('link[data-admin-payment-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/admin-payment-tools.css?rev=20260809-payment-v1';l.dataset.adminPaymentCss='1';document.head.appendChild(l)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();