(()=>{
  const cleanMap={
    'index.html':'/','courses.html':'/courses','course.html':'/course','cart.html':'/cart','wishlist.html':'/wishlist','login.html':'/login','signup.html':'/signup',
    'my-learning.html':'/my-learning','dashboard.html':'/dashboard','checkout.html':'/checkout','success.html':'/success','account.html':'/account','orders.html':'/orders',
    'messages.html':'/messages','notifications.html':'/notifications','plans.html':'/plans','practice.html':'/practice','categories.html':'/categories','gift.html':'/gift',
    'about.html':'/about','contact.html':'/contact','faq.html':'/faq','privacy.html':'/privacy','terms.html':'/terms','teach.html':'/teach',
    'instructor.html':'/instructor','admin.html':'/admin','instructor-profile.html':'/instructor-profile','learn.html':'/learn','certificate.html':'/certificate'
  };
  const cleanHref=href=>{
    if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('http://')||href.startsWith('https://'))return href;
    let raw=href.replace(/^\.\//,'');
    const q=raw.indexOf('?'),hash=raw.indexOf('#');
    let cut=raw.length;if(q>=0)cut=Math.min(cut,q);if(hash>=0)cut=Math.min(cut,hash);
    const path=raw.slice(0,cut),suffix=raw.slice(cut);
    return cleanMap[path]?cleanMap[path]+suffix:href;
  };
  const rewriteLinks=()=>document.querySelectorAll('a[href]').forEach(a=>{const n=cleanHref(a.getAttribute('href'));if(n)a.setAttribute('href',n)});
  const activeNav=()=>{
    const p=location.pathname.replace(/\/$/,'')||'/';
    document.querySelectorAll('.desktop-nav a,.mobile-nav a,.settings-nav a').forEach(a=>{
      try{const u=new URL(a.href,location.origin),ap=u.pathname.replace(/\/$/,'')||'/';if(ap===p||(p.startsWith('/course')&&ap==='/courses'))a.classList.add('portal-active')}catch{}
    });
  };
  const replaceText=(selector,from,to)=>document.querySelectorAll(selector).forEach(el=>{if(el.textContent.trim()===from)el.textContent=to});
  const productionWording=()=>{
    replaceText('.admin-demo-badge','Frontend Admin Demo','Admin Console');
    replaceText('.admin-profile small','Local browser data','Laravel + MySQL');
    document.querySelectorAll('.admin-heading p,.admin-stat-grid small,.settings-list p').forEach(el=>{
      el.textContent=el.textContent
        .replace(/static frontend demo/ig,'academy platform')
        .replace(/stored in this browser/ig,'stored for this account')
        .replace(/browser enrollments/ig,'learner enrollments')
        .replace(/registered locally/ig,'registered learners')
        .replace(/recorded demo orders/ig,'recorded orders')
        .replace(/local student accounts/ig,'student accounts')
        .replace(/demo enrollment orders/ig,'enrollment orders')
        .replace(/localStorage/ig,'platform data');
    });
    document.querySelectorAll('.checkout-muted,.auth-note,.order-empty').forEach(el=>{
      el.textContent=el.textContent.replace(/static frontend/ig,'academy platform').replace(/frontend-demo/ig,'academy').replace(/demo /ig,'');
    });
  };
  const enhanceTables=()=>document.querySelectorAll('table').forEach(t=>{if(!t.closest('.portal-table-scroll')&&!t.parentElement?.classList.contains('admin-table-wrap')){const w=document.createElement('div');w.className='portal-table-scroll';t.parentNode.insertBefore(w,t);w.appendChild(t)}});
  const mobileMenuClose=()=>document.querySelectorAll('#mobileNav a,.mobile-nav a').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('nav-open')));
  const markPage=()=>{const key=(document.body.dataset.page||document.body.dataset.dashboardPage||document.body.dataset.playerPage||location.pathname.split('/').filter(Boolean)[0]||'home').replace(/[^a-z0-9-]/gi,'');document.body.classList.add('portal-page-'+key)};
  document.addEventListener('DOMContentLoaded',()=>{
    rewriteLinks();activeNav();productionWording();enhanceTables();mobileMenuClose();markPage();
    setTimeout(()=>{rewriteLinks();activeNav();productionWording();mobileMenuClose()},80);
  });
})();
