(()=>{
  if(window.__bwaCleanRouteFixes)return;window.__bwaCleanRouteFixes=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(/\.html$/i.test(path))return;
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
  const toast=t=>{let x=qs('#suiteToast');if(!x){x=document.createElement('div');x.id='suiteToast';x.className='bwa-toast';document.body.appendChild(x)}x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200)};
  const FALLBACK={python:{title:'Python & Web Development Bootcamp',price:4999,image:'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80'},ai:{title:'Complete AI, ChatGPT & Prompt Engineering',price:5499,image:'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80'},data:{title:'Data Science & Analytics Career Track',price:6999,image:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80'},marketing:{title:'Digital Marketing, SEO & Social Media',price:3999,image:'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=900&q=80'},excel:{title:'Microsoft Excel for Business & Analytics',price:2999,image:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80'},cloud:{title:'Cloud Engineer Career Path',price:6499,image:'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80'}};
  const courseId=()=>new URLSearchParams(location.search).get('course')||'python';
  const localCourse=id=>({...FALLBACK[id],...(read('bwa_admin_courses',{})[id]||{})});

  function plans(){
    qs('.suite-banner')?.remove();
    const status=qs('#planStatus'),s=read('bwa_subscription',null);
    if(status)status.textContent=s?.active?`Active ${s.plan||''} plan · started ${new Date(s.started).toLocaleDateString()}`:'Choose a plan to start learning.';
    qsa('[data-plan]').forEach(b=>{if(b.dataset.cleanBound)return;b.dataset.cleanBound='1';b.addEventListener('click',()=>{const plan=b.dataset.plan;write('bwa_subscription',{active:true,plan,started:new Date().toISOString()});write('bwa_notifications',[{title:'Personal Plan activated',text:`Your ${plan} learning plan is now active.`,date:new Date().toISOString(),read:false},...read('bwa_notifications',[])]);toast('Personal Plan activated');setTimeout(()=>location.reload(),300)})});
    const cancel=qs('#cancelPlan');if(cancel&&!cancel.dataset.cleanBound){cancel.dataset.cleanBound='1';cancel.addEventListener('click',()=>{write('bwa_subscription',{active:false,cancelled:new Date().toISOString()});toast('Plan cancelled');setTimeout(()=>location.reload(),300)})}
  }

  function orders(){
    const list=qs('#orderHistory');if(!list)return;
    const rows=[...read('bwa_orders',[])],last=read('bwa_last_order',null);if(last&&!rows.some(x=>x.number===last.number))rows.unshift(last);
    if(!rows.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">↗</div><h2>No purchases yet</h2><p>Your completed course purchases will appear here.</p><a class="primary-btn" href="/courses">Browse courses</a></div>';return}
    list.innerHTML=rows.map(o=>`<article class="order-card2"><header><div><b>${o.number||'BWA ORDER'}</b><div class="order-meta"><span>${new Date(o.date||Date.now()).toLocaleDateString()}</span><span>${(o.ids||[]).length} course(s)</span><span>${money(o.total)}</span></div></div><span class="status-pill">Completed</span></header>${o.discount?`<p>Coupon ${o.discount.code}: ${o.discount.pct}% discount</p>`:''}<div class="order-actions"><button class="suite-secondary" data-receipt="${o.number||''}">View receipt</button><button class="suite-secondary" data-refund="${o.number||''}">Request refund</button></div></article>`).join('');
    qsa('[data-receipt]',list).forEach(b=>b.onclick=()=>{const o=rows.find(x=>(x.number||'')===b.dataset.receipt);if(o)alert(`Receipt\n${o.number}\n${money(o.total)}\n${new Date(o.date||Date.now()).toLocaleString()}`)});
    qsa('[data-refund]',list).forEach(b=>b.onclick=()=>{const req=read('bwa_refunds',[]);if(!req.some(x=>x.order===b.dataset.refund))req.unshift({order:b.dataset.refund,date:new Date().toISOString(),status:'Requested'});write('bwa_refunds',req);toast('Refund request recorded')});
  }

  async function account(){
    const u=read('bwa_user',{})||{},name=qs('#accountName'),email=qs('#accountEmail'),lang=qs('#accountLanguage'),dark=qs('#darkMode'),mail=qs('#emailNotifications');
    if(name)name.value=u.name||'';if(email)email.value=u.email||'';if(lang)lang.value=read('bwa_language','English');if(dark)dark.checked=read('bwa_dark_mode',false);if(mail)mail.checked=read('bwa_email_notifications',true);
    const form=qs('#accountForm');if(form&&!form.dataset.cleanBound){form.dataset.cleanBound='1';form.addEventListener('submit',async e=>{e.preventDefault();const profile={name:name?.value.trim()||'Learner',email:email?.value.trim()||''};try{await window.BWABackend?.ready;if(window.BWABackend?.available&&window.BWABackend?.user)await window.BWABackend.api('/api/profile',{method:'PUT',body:JSON.stringify(profile)});write('bwa_user',{...(read('bwa_user',{})||{}),...profile});write('bwa_language',lang?.value||'English');write('bwa_email_notifications',!!mail?.checked);toast('Account settings saved')}catch(err){toast(err.message||'Could not save account settings')}})}
    if(dark&&!dark.dataset.cleanBound){dark.dataset.cleanBound='1';dark.addEventListener('change',()=>{write('bwa_dark_mode',dark.checked);document.documentElement.classList.toggle('dark-mode',dark.checked)})}
    const logout=qs('#logoutAccount');if(logout&&!logout.dataset.cleanBound){logout.dataset.cleanBound='1';logout.addEventListener('click',async()=>{try{await window.BWABackend?.ready;if(window.BWABackend?.available&&window.BWABackend?.user)await window.BWABackend.api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}localStorage.removeItem('bwa_user');location.href='/'})}
  }

  async function gift(){
    const id=courseId(),fallback=localCourse(id),title=qs('#giftCourseTitle'),price=qs('#giftCoursePrice'),img=qs('#giftCourseImage');
    const paint=c=>{if(title)title.textContent=c.title||'Course';if(price)price.textContent=money(c.price);if(img){img.src=c.image||fallback.image;img.alt=c.title||'Course'}};paint(fallback);
    try{const r=await fetch(`/api/courses/${encodeURIComponent(id)}`,{headers:{Accept:'application/json'}});if(r.ok)paint(await r.json())}catch{}
    const form=qs('#giftForm');if(form&&!form.dataset.cleanBound){form.dataset.cleanBound='1';form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),g=read('bwa_gifts',[]),code='GIFT-'+Date.now().toString().slice(-7);g.unshift({course:id,recipient:fd.get('recipient'),sender:fd.get('sender'),message:fd.get('message'),date:new Date().toISOString(),code});write('bwa_gifts',g);const out=qs('#giftResult');if(out)out.textContent=`Gift order ${code} is ready. Recipient email delivery will be enabled when the mail service is connected.`;form.reset()})}
  }

  function notifications(){
    const list=qs('#notificationList');if(!list)return;let items=read('bwa_notifications',[]);if(!items.length){items=[{title:'Welcome to Best Way Academy',text:'Explore courses and start learning today.',date:new Date().toISOString(),read:false},{title:'New AI courses available',text:'Build practical generative AI skills with new learning paths.',date:new Date(Date.now()-86400000).toISOString(),read:true}];write('bwa_notifications',items)}
    const render=()=>{list.innerHTML=items.map((n,i)=>`<article class="notification-card ${n.read?'':'unread'}" data-n="${i}"><header><b>${n.title}</b><small>${new Date(n.date).toLocaleString()}</small></header><p>${n.text}</p></article>`).join('');qsa('[data-n]',list).forEach(x=>x.onclick=()=>{items[Number(x.dataset.n)].read=true;write('bwa_notifications',items);render()})};render();
    const all=qs('#markAllRead');if(all&&!all.dataset.cleanBound){all.dataset.cleanBound='1';all.addEventListener('click',()=>{items=items.map(x=>({...x,read:true}));write('bwa_notifications',items);render()})}
  }

  function messages(){
    const tl=qs('#threadList'),chat=qs('#chatMessages'),head=qs('#chatHead'),form=qs('#messageForm');if(!tl||!chat||!head)return;
    let threads=read('bwa_messages',null);if(!threads){threads=[{id:'instructor',name:'Best Way Instructor',messages:[{me:false,text:'Welcome! Ask any course-related question here.'}]},{id:'support',name:'Learner Support',messages:[{me:false,text:'How can we help with your learning experience?'}]}];write('bwa_messages',threads)}let active=threads[0]?.id;
    const render=()=>{tl.innerHTML=threads.map(t=>`<div class="thread ${t.id===active?'active':''}" data-thread="${t.id}"><b>${t.name}</b><span>${t.messages.at(-1)?.text||'No messages'}</span></div>`).join('');const t=threads.find(x=>x.id===active);head.textContent=t?.name||'';chat.innerHTML=(t?.messages||[]).map(m=>`<div class="bubble ${m.me?'me':''}">${m.text}</div>`).join('');chat.scrollTop=chat.scrollHeight;qsa('[data-thread]',tl).forEach(x=>x.onclick=()=>{active=x.dataset.thread;render()})};render();
    if(form&&!form.dataset.cleanBound){form.dataset.cleanBound='1';form.addEventListener('submit',e=>{e.preventDefault();const input=qs('#messageInput'),text=input?.value.trim();if(!text)return;threads.find(x=>x.id===active)?.messages.push({me:true,text,date:new Date().toISOString()});write('bwa_messages',threads);input.value='';render()})}
  }

  function practice(){
    const id=courseId(),c=localCourse(id),title=qs('#practiceTitle');if(title)title.textContent=`Practice: ${c.title}`;
    const show=m=>{qsa('[data-practice-tab]').forEach(x=>x.classList.toggle('active',x.dataset.practiceTab===m));qsa('.practice-panel').forEach(x=>x.hidden=x.dataset.practicePanel!==m)};qsa('[data-practice-tab]').forEach(x=>{if(x.dataset.cleanBound)return;x.dataset.cleanBound='1';x.addEventListener('click',()=>show(x.dataset.practiceTab))});show('test');
    const test=qs('#practiceTest');if(test&&!test.dataset.cleanBound){test.dataset.cleanBound='1';test.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(test),answers=['b','a','c','b','a'];let score=0;answers.forEach((a,i)=>{if(fd.get('q'+(i+1))===a)score++});const pct=score*20;write(`bwa_practice_${id}`,{score:pct,date:new Date().toISOString()});qs('#testScore').innerHTML=`<b>Score: ${pct}%</b><br>${pct>=80?'Great work — strong result!':'Review the questions and try again.'}`})}
    const run=qs('#runCode');if(run&&!run.dataset.cleanBound){run.dataset.cleanBound='1';run.addEventListener('click',()=>{const code=qs('#codeExercise')?.value||'',ok=/function|def |console\.log|print\(/i.test(code);qs('#codeResult').textContent=ok?'✓ Code structure detected. Basic checks passed.':'Add a function or output statement, then run again.'})}
    qsa('[data-lab-complete]').forEach(b=>{if(b.dataset.cleanBound)return;b.dataset.cleanBound='1';const done=read(`bwa_labs_${id}`,[]).includes(b.dataset.labComplete);if(done){b.textContent='✓ Completed';b.disabled=true}b.addEventListener('click',()=>{const labs=read(`bwa_labs_${id}`,[]);if(!labs.includes(b.dataset.labComplete))labs.push(b.dataset.labComplete);write(`bwa_labs_${id}`,labs);b.textContent='✓ Completed';b.disabled=true})});
  }

  function teach(){const b=qs('#startTeaching');if(b&&!b.dataset.cleanBound){b.dataset.cleanBound='1';b.addEventListener('click',()=>location.href='/instructor')}}

  const run=()=>{if(path==='/plans')plans();if(path==='/orders')orders();if(path==='/account')account();if(path==='/gift')gift();if(path==='/notifications')notifications();if(path==='/messages')messages();if(path==='/practice')practice();if(path==='/teach')teach()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
