const DASH_COURSES={
python:{title:'Python & Web Development Bootcamp',image:'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=700&q=80'},
ai:{title:'Complete AI, ChatGPT & Prompt Engineering',image:'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=700&q=80'},
data:{title:'Data Science & Analytics Career Track',image:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=700&q=80'},
marketing:{title:'Digital Marketing, SEO & Social Media',image:'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=700&q=80'},
excel:{title:'Microsoft Excel for Business & Analytics',image:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=700&q=80'},
cloud:{title:'Cloud Engineer Career Path',image:'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=700&q=80'}
};
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const $=s=>document.querySelector(s);
function safeDate(v){if(!v)return'—';try{return new Date(v).toLocaleDateString('en-PK',{year:'numeric',month:'short',day:'numeric'})}catch{return'—'}}
function money(n){return `Rs ${Number(n||0).toLocaleString('en-PK')}`}
function renderDashboard(){
  const user=read('bwa_user',null),enrolled=read('bwa_enrollments',[]),wish=read('bwa_wishlist',[]),cart=read('bwa_cart',[]),last=read('bwa_last_order',null);
  const name=user?.name||'Learner',email=user?.email||'Not signed in';
  $('#dashGreeting').textContent=`Welcome back, ${name.split(' ')[0]||'Learner'}`;
  $('#accountName').textContent=name;$('#accountEmail').textContent=email;$('#accountAvatar').textContent=(name||email||'L').trim().charAt(0).toUpperCase();
  $('#profileName').value=user?.name||'';$('#profileEmail').value=user?.email||'';
  const valid=enrolled.filter(x=>DASH_COURSES[x.id]);const avg=valid.length?Math.round(valid.reduce((n,x)=>n+Number(x.progress||0),0)/valid.length):0;const certs=valid.filter(x=>Number(x.progress||0)>=100).length;
  $('#statEnrolled').textContent=valid.length;$('#statProgress').textContent=`${avg}%`;$('#statCertificates').textContent=certs;$('#statWishlist').textContent=wish.length;$('#quickWishlist').textContent=`${wish.length} saved course${wish.length===1?'':'s'}`;$('#quickCart').textContent=`${cart.length} course${cart.length===1?'':'s'}`;
  const list=$('#dashLearningList'),empty=$('#dashLearningEmpty');if(!valid.length){empty.hidden=false;list.innerHTML=''}else{empty.hidden=true;list.innerHTML=valid.slice(0,4).map(x=>{const c=DASH_COURSES[x.id],p=Math.max(0,Math.min(100,Number(x.progress||0)));return `<article class="dash-course"><img src="${c.image}" alt="${c.title}"><div><h3>${c.title}</h3><p>Enrolled ${safeDate(x.date)}</p><div class="dash-progress"><i style="width:${p}%"></i></div><small>${p}% complete${p>=100?' · Certificate ready':''}</small></div><a href="${p>=100?`certificate.html?course=${x.id}`:`learn.html?course=${x.id}`}">${p>=100?'Certificate':p?'Continue':'Start'}</a></article>`}).join('')}
  const order=$('#latestOrder');if(last?.number){order.innerHTML=`<div class="order-box"><div><p class="order-number">${last.number}</p><p>${safeDate(last.date)} · ${Array.isArray(last.ids)?last.ids.length:0} course${last.ids?.length===1?'':'s'}</p></div><strong>${money(last.total)}</strong></div>`}else{order.innerHTML='<p class="order-empty">No completed checkout yet. Your latest frontend-demo order will appear here.</p>'}
}
$('#profileForm')?.addEventListener('submit',e=>{e.preventDefault();const name=$('#profileName').value.trim(),email=$('#profileEmail').value.trim();if(!name||!email){$('#profileMessage').textContent='Please enter your name and email.';return}write('bwa_user',{name,email});$('#profileMessage').textContent='Profile saved in this browser.';renderDashboard()});
$('#logoutBtn')?.addEventListener('click',()=>{localStorage.removeItem('bwa_user');location.href='login.html'});
document.addEventListener('DOMContentLoaded',renderDashboard);
