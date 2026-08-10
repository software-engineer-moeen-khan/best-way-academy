(()=>{
'use strict';
const $=s=>document.querySelector(s);
let active='instructor',messages=[],sending=false;
const names={instructor:'Instructor messages',support:'Learner Support'};

async function backend(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Message service is still loading.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Message service is unavailable.');
  if(!window.BWABackend.user)throw new Error('Please sign in to use messages.');
  return window.BWABackend;
}

function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatDate(v){try{return new Date(v).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}catch{return ''}}
function grouped(channel){return messages.filter(m=>m.channel===channel)}

function render(){
  const list=$('#threadList'),chat=$('#chatMessages'),head=$('#chatHead');
  if(!list||!chat||!head)return;
  list.innerHTML=['instructor','support'].map(channel=>{
    const items=grouped(channel),last=items.at(-1);
    return `<div class="thread ${active===channel?'active':''}" data-backend-thread="${channel}"><b>${names[channel]}</b><span>${last?safe(last.body):'Start a conversation'}</span></div>`;
  }).join('');
  head.innerHTML=`<b>${names[active]}</b><small style="display:block;font-weight:400;opacity:.7;margin-top:3px">Messages are sent to the academy administration team.</small>`;
  const items=grouped(active);
  chat.innerHTML=items.length?items.map(m=>`<div class="bubble ${m.mine?'me':''}"><div>${safe(m.body)}</div><small style="display:block;margin-top:5px;opacity:.65;font-size:11px">${m.mine?'You':safe(m.sender_name||'Academy Admin')} · ${formatDate(m.created_at)}</small></div>`).join(''):`<div class="empty-state" style="padding:28px 12px"><p>No ${active} messages yet.</p><small>Write a message below and it will go directly to the Admin Panel.</small></div>`;
  chat.scrollTop=chat.scrollHeight;
  list.querySelectorAll('[data-backend-thread]').forEach(el=>el.addEventListener('click',()=>{active=el.dataset.backendThread;render()}));
}

async function load(){
  try{
    const b=await backend();
    const out=await b.api('/api/message-center');
    messages=Array.isArray(out?.messages)?out.messages:[];
    render();
  }catch(err){
    const chat=$('#chatMessages');if(chat)chat.innerHTML=`<div class="empty-state"><p>${safe(err?.message||'Messages could not be loaded.')}</p></div>`;
  }
}

async function submit(form){
  if(sending)return;
  const input=$('#messageInput'),text=String(input?.value||'').trim();
  if(!text)return;
  sending=true;
  const button=form.querySelector('button');if(button){button.disabled=true;button.textContent='Sending…'}
  try{
    const b=await backend();
    await b.api('/api/message-center',{method:'POST',body:JSON.stringify({channel:active,body:text})});
    if(input)input.value='';
    await load();
  }catch(err){alert(err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Message could not be sent.'))}
  finally{sending=false;if(button){button.disabled=false;button.textContent='Send'}}
}

// Capture before the old browser-demo handler so messages are never stored only in localStorage.
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='messageForm')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();submit(form);
},true);

const init=()=>load();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
