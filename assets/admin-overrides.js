(()=>{
  const money=n=>`Rs ${Number(n||0).toLocaleString('en-PK')}`;
  let overrides={};
  try{overrides=JSON.parse(localStorage.getItem('bwa_admin_courses')||'{}')||{}}catch{}
  if(typeof COURSE_DATA!=='undefined'){
    Object.entries(overrides).forEach(([id,patch])=>{
      if(!COURSE_DATA[id])return;
      Object.assign(COURSE_DATA[id],patch);
      if(Object.prototype.hasOwnProperty.call(patch,'price'))COURSE_DATA[id].priceLabel=money(patch.price);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const page=document.body.dataset.page||'';
    if(page==='courses'){
      document.querySelectorAll('#catalogGrid .course-card').forEach(card=>{
        const id=new URL(card.href,location.href).searchParams.get('course');
        const patch=overrides[id];if(!patch)return;
        if(patch.status==='hidden'){card.style.display='none';card.dataset.adminHidden='1';}
        const title=card.querySelector('h3'),price=card.querySelector('.price');
        if(title&&patch.title)title.textContent=patch.title;
        if(price&&patch.price!=null)price.textContent=money(patch.price);
        if(patch.category)card.dataset.category=patch.category;
      });
    }
    if(page==='course'){
      const id=new URLSearchParams(location.search).get('course')||'python',patch=overrides[id];
      if(patch?.status==='hidden'){
        const enroll=document.querySelector('#enrollNow');
        if(enroll){enroll.removeAttribute('href');enroll.textContent='Currently unavailable';enroll.style.pointerEvents='none';enroll.style.opacity='.55';}
      }
    }
    if(page==='success'){
      try{
        const last=JSON.parse(localStorage.getItem('bwa_last_order')||'null');
        if(last?.number){
          const orders=JSON.parse(localStorage.getItem('bwa_orders')||'[]')||[];
          if(!orders.some(o=>o.number===last.number)){orders.unshift(last);localStorage.setItem('bwa_orders',JSON.stringify(orders.slice(0,50)));}
        }
      }catch{}
    }
  });
})();
