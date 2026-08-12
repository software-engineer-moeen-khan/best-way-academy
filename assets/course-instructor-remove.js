(()=>{
'use strict';
if(window.__bwaCourseInstructorRemoved)return;
window.__bwaCourseInstructorRemoved=true;

function isCoursePage(){
  return location.pathname==='/course'||location.pathname==='/course.html'||document.body?.dataset?.page==='course';
}

function removeInstructor(){
  if(!isCoursePage())return;
  document.querySelectorAll('#marketplaceDetails .instructor-card,.market-details .instructor-card').forEach(card=>{
    const section=card.closest('.market-section');
    if(section) section.remove();
    else card.remove();
  });

  document.querySelectorAll('#marketplaceDetails .market-section,.market-details .market-section').forEach(section=>{
    const heading=section.querySelector(':scope > h2,:scope > h3');
    if(heading?.textContent.trim().toLowerCase()==='instructor')section.remove();
  });
}

function init(){
  if(!isCoursePage())return;
  removeInstructor();
  const observer=new MutationObserver(removeInstructor);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',removeInstructor,{once:true});
  setTimeout(removeInstructor,0);
  setTimeout(removeInstructor,100);
  setTimeout(removeInstructor,500);
  setTimeout(removeInstructor,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
