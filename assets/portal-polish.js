(()=>{
  const cleanMap={
    'index.html':'/','courses.html':'/courses','course.html':'/course','cart.html':'/cart','wishlist.html':'/wishlist','login.html':'/login','signup.html':'/signup',
    'my-learning.html':'/my-learning','dashboard.html':'/dashboard','checkout.html':'/checkout','success.html':'/success','account.html':'/account','orders.html':'/orders',
    'messages.html':'/messages','notifications.html':'/notifications','plans.html':'/plans','practice.html':'/practice','categories.html':'/categories','gift.html':'/gift',
    'about.html':'/about','contact.html':'/contact','faq.html':'/faq','privacy.html':'/privacy','terms.html':'/terms','teach.html':'/teach',
    'instructor.html':'/instructor','admin.html':'/admin','instructor-profile.html':'/instructor-profile','learn.html':'/learn','certificate.html':'/certificate'
  };
  const cleanHref=href=>{
    if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('http://')||href.startsWith('https://')||href.startsWith('/assets/'))return href;
    const raw=href.replace(/^\.\//,'');
    const q=raw.indexOf('?'),hash=raw.indexOf('#');let cut=raw.length;
    if(q>=0)cut=Math.min(cut,q);if(hash>=0)cut=Math.min(cut,hash);
    const path=raw.slice(0,cut),suffix=raw.slice(cut);
    return cleanMap[path]?cleanMap[path]+suffix:href;
  };
  const rewriteLinks=root=>(root.querySelectorAll?root:document).querySelectorAll('a[href]').forEach(a=>{
    const old=a.getAttribute('href'),next=cleanHref(old);if(next&&next!==old)a.setAttribute('href',next);
  });
  const activeNav=()=>{
    const p=location.pathname.replace(/\/$/,'')||'/';
    document.querySelectorAll('.desktop-nav a,.mobile-nav a,.settings-nav a,.instructor-top nav a').forEach(a=>{
      try{const u=new URL(a.href,location.origin),ap=u.pathname.replace(/\/$/,'')||'/';const active=ap===p||(p.startsWith('/course')&&ap==='/courses');a.classList.toggle('portal-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}catch{}
    });
  };
  const productionWording=root=>{
    const scope=root.querySelectorAll?root:document;
    scope.querySelectorAll('.admin-demo-badge').forEach(el=>{if(/frontend admin demo/i.test(el.textContent))el.textContent='Admin Console'});
    scope.querySelectorAll('.admin-profile small').forEach(el=>{if(/local browser data/i.test(el.textContent))el.textContent='Laravel + MySQL'});
    scope.querySelectorAll('p,small,span').forEach(el=>{
      if(el.children.length)return;
      let t=el.textContent;
      t=t.replace(/static frontend demo/ig,'academy platform')
        .replace(/frontend demo/ig,'academy interface')
        .replace(/stored only in this browser/ig,'secured to your account')
        .replace(/saved in this browser/ig,'saved to your account')
        .replace(/browser enrollments/ig,'learner enrollments')
        .replace(/registered locally/ig,'registered learners')
        .replace(/local student accounts/ig,'student accounts')
        .replace(/recorded demo orders/ig,'recorded orders')
        .replace(/demo enrollment orders/ig,'enrollment orders')
        .replace(/localStorage/ig,'platform data')
        .replace(/demo receipts/ig,'receipts')
        .replace(/demo learner profile/ig,'learner profile')
        .replace(/unlimited demo access/ig,'flexible access');
      if(t!==el.textContent)el.textContent=t;
    });
  };
  const enhanceTables=root=>(root.querySelectorAll?root:document).querySelectorAll('table').forEach(t=>{
    if(t.closest('.portal-table-scroll')||t.parentElement?.classList.contains('admin-table-wrap'))return;
    const w=document.createElement('div');w.className='portal-table-scroll';t.parentNode.insertBefore(w,t);w.appendChild(t);
  });
  const improveMedia=root=>{
    const scope=root.querySelectorAll?root:document;
    scope.querySelectorAll('img:not([loading])').forEach(img=>{if(!img.closest('.lesson-stage'))img.loading='lazy'});
  };
  const ensureMobileNavigation=()=>{
    const header=document.querySelector('.site-header');
    if(!header||document.body.classList.contains('checkout-page')||document.body.classList.contains('admin-body')||document.body.classList.contains('instructor-app')||document.querySelector('.player-layout,.certificate-wrap'))return;
    let actions=header.querySelector('.header-actions');
    if(!actions){actions=document.createElement('div');actions.className='header-actions';header.appendChild(actions)}
    let button=header.querySelector('#globalMenuBtn');
    const createdButton=!button;
    if(!button){button=document.createElement('button');button.id='globalMenuBtn';button.className='menu-btn';button.type='button';button.setAttribute('aria-label','Open navigation');button.setAttribute('aria-expanded','false');button.textContent='☰';actions.appendChild(button)}
    let nav=document.querySelector('#mobileNav');
    if(!nav){nav=document.createElement('nav');nav.id='mobileNav';nav.className='mobile-nav';nav.setAttribute('aria-label','Mobile navigation');nav.innerHTML='<a href="/">Home</a><a href="/courses">All courses</a><a href="/categories">Categories</a><a href="/plans">Plans</a><a href="/my-learning">My Learning</a><a href="/practice?course=python">Practice</a><a href="/wishlist">Wishlist</a><a href="/cart">Cart</a><a href="/account">Account</a><a href="/contact">Support</a>';header.insertAdjacentElement('afterend',nav)}
    if(createdButton&&!button.dataset.portalMenuBound){button.dataset.portalMenuBound='1';button.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');button.setAttribute('aria-expanded',open?'true':'false');button.setAttribute('aria-label',open?'Close navigation':'Open navigation')})}
  };
  const closeMobileNav=()=>document.querySelectorAll('#mobileNav a,.mobile-nav a').forEach(a=>{if(a.dataset.portalCloseBound)return;a.dataset.portalCloseBound='1';a.addEventListener('click',()=>{document.body.classList.remove('nav-open');document.querySelector('#globalMenuBtn')?.setAttribute('aria-expanded','false')})});
  const bindMobileNavGlobal=()=>{
    if(window.__bwaMobileNavGlobal)return;window.__bwaMobileNavGlobal=true;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){document.body.classList.remove('nav-open');document.querySelector('#globalMenuBtn')?.setAttribute('aria-expanded','false')}});
    window.addEventListener('resize',()=>{if(innerWidth>780&&document.body.classList.contains('nav-open')){document.body.classList.remove('nav-open');document.querySelector('#globalMenuBtn')?.setAttribute('aria-expanded','false')}},{passive:true});
  };
  const bindSupportFeedback=()=>{
    const form=document.querySelector('#contactForm');if(!form||form.dataset.portalFeedbackBound)return;form.dataset.portalFeedbackBound='1';
    form.addEventListener('submit',()=>setTimeout(()=>{const m=document.querySelector('#contactMessage');if(m){m.textContent='Message checked successfully. Support email delivery is not configured yet.';m.classList.add('success-message')}},0));
  };
  const markPage=()=>{const key=(document.body.dataset.page||document.body.dataset.dashboardPage||document.body.dataset.playerPage||location.pathname.split('/').filter(Boolean)[0]||'home').replace(/[^a-z0-9-]/gi,'');document.body.classList.add('portal-page-'+key)};
  const ensureFooter=()=>{
    if(document.querySelector('footer,.portal-footer')||document.body.classList.contains('admin-body')||document.body.classList.contains('instructor-app')||document.body.classList.contains('checkout-page')||document.querySelector('.player-layout,.certificate-wrap'))return;
    const f=document.createElement('footer');f.className='portal-footer';f.innerHTML='<div class="portal-footer-inner"><div><div class="brand footer-brand"><span class="brand-mark">B</span><span>Best Way <b>Academy</b></span></div><small>Practical learning for modern careers.</small></div><nav><a href="/courses">Courses</a><a href="/my-learning">My Learning</a><a href="/plans">Plans</a><a href="/contact">Support</a><a href="/privacy">Privacy</a></nav></div>';
    document.body.appendChild(f);
  };
  const run=root=>{rewriteLinks(root);productionWording(root);enhanceTables(root);improveMedia(root);ensureMobileNavigation();closeMobileNav();activeNav();bindSupportFeedback()};
  document.addEventListener('DOMContentLoaded',()=>{
    markPage();bindMobileNavGlobal();run(document);ensureFooter();
    const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)run(n)})));
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{run(document);ensureFooter()},180);
  });
})();
