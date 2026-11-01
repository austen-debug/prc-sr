// Lightweight lock notification for already-open operational tabs. The server
// remains authoritative: this is never an authorization control.
(function(){
  'use strict';
  let busy=false, locked=false;
  async function check(){
    if(busy||locked)return;
    busy=true;
    try {
      const response=await fetch('/api/site-status',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(response.status===401||response.status===423) {locked=true;location.replace(location.pathname);return;}
      if(!response.ok) return; // Server-side API gate continues to enforce lock.
      const state=await response.json();
      if(state?.isOk&&state.locked===true){locked=true;location.replace(location.pathname);}
    }catch(_){}finally{busy=false;}
  }
  window.setInterval(check,5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('focus',check);
  check();
})();
