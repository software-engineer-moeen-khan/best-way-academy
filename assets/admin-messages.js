(()=>{
'use strict';
const $=s=>document.querySelector(s);
let inbox={messages:[],support_requests:[]},loading=false;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'}):'—';

function installUi(){
  const nav=$('#adminTabs');
  if(nav&&!nav.querySelector('[data-tab="messages"]')){
    const button=document.createElement('button');
    button.dataset.tab='messages';button.innerHTML='<span>✉</span> Messages';
    const support=nav.querySelector('[data-tab="support"]');
    support?nav.insertBefore(button,support):nav.appendChild(button);
  }

  const main=$('.admin-main');
  if(main&&!main.querySelector('[data-panel="messages"]')){
    const section=document.createElement('section');
    section.className='admin-section';section.dataset.panel='messages';
    section.innerHTML=`
      <div class="admin-heading"><div><p class="eyebrow">INBOX</p><h1>Messages</h1><p>Instructor, learner-support and public support messages in one place.</p></div><button id="adminMessagesRefresh" class="admin-outline" type="button">Refresh messages</button></div>
      <div class="admin-stat-grid admin-message-stats"><article><span>Direct messages</span><strong id="adminDirectMessageCount">0</strong><small>Instructor & support threads</small></article><article><span>Contact support</span><strong id="adminContactMessageCount">0</strong><small>Website support requests</small></article><article><span>Incoming</span><strong id="adminIncomingMessageCount">0</strong><small>Messages needing attention</small></article></div>
      <div class="admin-toolbar"><input id="adminMessageSearch" type="search" placeholder="Search sender, email, subject or message…"><select id="adminMessageType"><option value="">All messages</option><option value="instructor">Instructor</option><option value="support">Support thread</option><option value="contact">Contact support</option></select></div>
      <div class="admin-card admin-table-wrap"><table class="admin-table admin-table-wide"><thead><tr><th>Type</th><th>Sender</th><th>Message</th><th>Status</th><th>Received</th><th>Actions</th></tr></thead><tbody id="adminMessagesBody"></tbody></table><div id="adminMessagesEmpty" class="admin-empty" hidden>No messages found.</div></div>`;
    const supportPanel=main.querySelector('[data-panel="support"]');
    supportPanel?main.insertBefore(section,supportPanel):main.appendChild(section);
  }

  if(!$('#adminMessageReplyDialog')){
    document.body.insertAdjacentHTML('beforeend',`<dialog id="adminMessageReplyDialog" class="admin-dialog"><form id="adminMessageReplyForm"><div class="dialog-head"><div><p class="eyebrow">REPLY</p><h2 id="adminMessageReplyTitle">Reply to message</h2></div><button type="button" data-admin-message-close>×</button></div><input type="hidden" name="user_id"><input type="hidden" name="channel"><label>Subject<input name="subject" maxlength="180" placeholder="Reply from Best Way Academy"></label><label>Message<textarea name="body" rows="7" required maxlength="5000" placeholder="Write your reply…"></textarea></label><div class="dialog-actions"><button type="button" class="admin-outline" data-admin-message-close>Cancel</button><button type="submit" class="admin-primary">Send reply</button></div></form></dialog>`);
  }

  if(!$('#adminMessageCenterStyle')){
    const style=document.createElement('style');style.id='adminMessageCenterStyle';
    style.textContent='.admin-message-stats{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:18px}.admin-message-preview{max-width:620px;white-space:normal;line-height:1.45}.admin-message-preview b{display:block;margin-bottom:4px}.admin-message-preview small{display:block;margin-top:5px;color:#6b7280}.message-channel{display:inline-flex;padding:4px 8px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:800;text-transform:capitalize}.message-channel.support{background:#ecfdf5}.message-channel.contact{background:#fff7ed}.admin-message-direction{font-size:12px;font-weight:700}.admin-message-direction.out{color:#64748b}@media(max-width:1024px){.admin-message-stats{grid-template-columns:1fr 1fr}}@media(max-width:640px){.admin-message-stats{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }
}

async function backend(){
  for(let i=0;i<120&&!window.BWABackend;i++)await new Promise(r=>setTimeout(r,40));
  if(!window.BWABackend)throw new Error('Admin message service is still loading.');
  await window.BWABackend.ready;
  if(!window.BWABackend.available)throw new Error('Admin message service is unavailable.');
  if(window.BWABackend.user?.role!=='admin')throw new Error('Administrator access is required.');
  return window.BWABackend;
}

function rows(){
  const direct=(inbox.messages||[]).map(x=>({...x,type:x.channel==='instructor'?'instructor':'support'}));
  const contact=(inbox.support_requests||[]).map(x=>({...x,type:'contact'}));
  return [...direct,...contact].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}

function render(){
  $('#adminDirectMessageCount')&&($('#adminDirectMessageCount').textContent=String((inbox.messages||[]).length));
  $('#adminContactMessageCount')&&($('#adminContactMessageCount').textContent=String((inbox.support_requests||[]).length));
  $('#adminIncomingMessageCount')&&($('#adminIncomingMessageCount').textContent=String((inbox.messages||[]).filter(x=>!x.from_admin).length+(inbox.support_requests||[]).filter(x=>!['resolved','closed'].includes(x.status)).length));
  const q=String($('#adminMessageSearch')?.value||'').trim().toLowerCase(),type=$('#adminMessageType')?.value||'';
  const list=rows().filter(x=>(!type||x.type===type)&&(!q||`${x.sender_name||''} ${x.sender_email||''} ${x.subject||''} ${x.body||''}`.toLowerCase().includes(q)));
  const body=$('#adminMessagesBody');if(!body)return;
  body.innerHTML=list.map(x=>{
    const channel=x.type==='contact'?'Contact support':(x.type==='instructor'?'Instructor':'Support');
    const status=x.type==='contact'?`<select data-center-support-status="${x.id}"><option value="open" ${x.status==='open'?'selected':''}>Open</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>In progress</option><option value="resolved" ${x.status==='resolved'?'selected':''}>Resolved</option><option value="closed" ${x.status==='closed'?'selected':''}>Closed</option></select>`:`<span class="admin-message-direction ${x.from_admin?'out':'in'}">${x.from_admin?'Admin reply':'Incoming'}</span>`;
    const actions=x.type==='contact'?`<a class="admin-small admin-link" href="mailto:${encodeURIComponent(x.sender_email||'')}">Email</a>`:`<button class="admin-small primary" data-message-reply="${x.user_id}" data-message-channel="${x.channel}" data-message-name="${safe(x.sender_name||'User')}">Reply</button>`;
    return `<tr><td><span class="message-channel ${x.type}">${channel}</span></td><td><strong>${safe(x.sender_name||'Unknown')}</strong><small style="display:block">${safe(x.sender_email||'')}</small></td><td><div class="admin-message-preview"><b>${safe(x.subject||channel)}</b>${safe(x.body)}<small>${x.from_admin?'Sent by admin':'Received by admin'}</small></div></td><td>${status}</td><td>${date(x.created_at)}</td><td><div class="admin-actions">${actions}</div></td></tr>`;
  }).join('');
  const empty=$('#adminMessagesEmpty');if(empty)empty.hidden=list.length>0;
}

async function load(){
  if(loading)return;loading=true;
  try{const b=await backend();inbox=await b.api('/api/admin/manage/messages');render()}
  catch(err){const empty=$('#adminMessagesEmpty');if(empty){empty.hidden=false;empty.textContent=err?.message||'Messages could not be loaded.'}}
  finally{loading=false}
}

function openReply(button){
  const dialog=$('#adminMessageReplyDialog'),form=$('#adminMessageReplyForm');if(!dialog||!form)return;
  form.reset();form.elements.user_id.value=button.dataset.messageReply;form.elements.channel.value=button.dataset.messageChannel;
  form.elements.subject.value=button.dataset.messageChannel==='instructor'?'Instructor message reply':'Support message reply';
  $('#adminMessageReplyTitle').textContent=`Reply to ${button.dataset.messageName||'user'}`;
  dialog.showModal();
}

async function sendReply(form){
  const user=form.elements.user_id.value,channel=form.elements.channel.value,subject=form.elements.subject.value.trim(),body=form.elements.body.value.trim();
  if(!body)return;
  const button=form.querySelector('button[type="submit"]'),old=button.textContent;button.disabled=true;button.textContent='Sending…';
  try{const b=await backend();await b.api(`/api/admin/manage/messages/${user}/reply`,{method:'POST',body:JSON.stringify({channel,subject:subject||null,body})});$('#adminMessageReplyDialog').close();await load()}
  catch(err){alert(err?.data?.errors?Object.values(err.data.errors).flat().join(' '):(err?.message||'Reply could not be sent.'))}
  finally{button.disabled=false;button.textContent=old}
}

installUi();
$('#adminMessageSearch')?.addEventListener('input',render);$('#adminMessageType')?.addEventListener('change',render);$('#adminMessagesRefresh')?.addEventListener('click',load);
$('#adminRefresh')?.addEventListener('click',()=>setTimeout(load,150));
document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target.closest('[data-message-reply],[data-admin-message-close]'):null;if(!el)return;if(el.hasAttribute('data-message-reply'))openReply(el);else $('#adminMessageReplyDialog')?.close()});
document.addEventListener('change',async e=>{const el=e.target;if(!(el instanceof HTMLSelectElement)||!el.dataset.centerSupportStatus)return;try{const b=await backend();await b.api(`/api/admin/support-requests/${el.dataset.centerSupportStatus}`,{method:'PATCH',body:JSON.stringify({status:el.value})});await load()}catch(err){alert(err?.message||'Status could not be updated.')}});
$('#adminMessageReplyForm')?.addEventListener('submit',e=>{e.preventDefault();sendReply(e.currentTarget)});

const init=()=>load();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
