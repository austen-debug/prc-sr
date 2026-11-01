// Administration-only UI for Site Lock and emergency Week Group commands.
// Authoritative state, permissions, and transactions remain server-owned.
(function(){
  'use strict';
  const by=id=>document.getElementById(id);
  const status=(id,message,error=false)=>{
    const el=by(id);if(!el)return;
    el.textContent=message;el.classList.toggle('warning',error);
  };
  const api=async(path,options={})=>{
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
    const body=await response.json().catch(()=>({isOk:false,code:'invalid_response'}));
    if(!response.ok||!body.isOk)throw Error(body.error||body.code||'Request failed');
    return body;
  };
  let lock=null,recovery=null,requestInFlight=false;
  const setText=(id,value)=>{if(by(id))by(id).textContent=String(value??'—');};
  const disabled=(id,value)=>{if(by(id))by(id).disabled=Boolean(value);};

  async function loadLock(){
    try{
      const data=await api('/api/admin-system');
      lock=data.site_lock;
      setText('site-lock-state',lock.locked?'SITE LOCKED':'SITE OPERATIONAL');
      setText('site-lock-revision',lock.revision);
      setText('site-lock-details',!lock.installed?'Migration 0012 is not installed.':
        !data.systemControlEnabled?'The Admin system-control switch is disabled.':
        lock.locked?'Non-Admin access is suspended.':'Non-Admin access is available.');
      const available=lock.installed&&data.systemControlEnabled;
      disabled('site-lock-button',!available);
      setText('site-lock-button',lock.locked?'UNLOCK SITE':'LOCK SITE');
      by('site-lock-button').dataset.action=lock.locked?'unlock':'lock';
    }catch(error){
      status('site-lock-status','Unable to verify Site Lock: '+error.message,true);
      disabled('site-lock-button',true);
    }
  }
  async function loadRecovery(){
    recovery=null;
    for(const id of ['admin-reset-week','admin-archive-zero'])disabled(id,true);
    try{
      const data=await api('/api/admin-recovery');
      recovery=data;
      const label=data.week_group;
      setText('admin-recovery-group',label);
      setText('admin-recovery-counts',data.dorm_count+' dorms · '+data.bus_count+
        ' buses · '+data.sound_count+' sound events · '+data.arrived+
        ' arrived · '+data.loaded+' loaded · '+data.expected+' expected');
      setText('admin-recovery-status',data.locked?'Site Lock active.':
        'Lock the site before executing emergency recovery.');
      disabled('admin-reset-week',!data.locked||!data.reset_available||!data.adminRecoveryEnabled);
      disabled('admin-archive-zero',!data.locked||!data.adminRecoveryEnabled);
      setText('admin-recovery-manifest',data.reset_available?'Original Input manifest verified.':
        (data.reset_unavailable_reason||'Reset unavailable until Input manifest is verified.'));
    }catch(error){
      setText('admin-recovery-group','NO ACTIVE WEEK GROUP');
      setText('admin-recovery-counts','No recoverable active receiving cycle.');
      setText('admin-recovery-manifest','Emergency recovery is disabled when no verified cycle exists.');
      status('admin-recovery-status',error.message,true);
    }
  }
  function openConfirmation(action){
    if(requestInFlight)return;
    const isLock=action==='lock'||action==='unlock';
    const group=recovery?.week_group||'';
    const label=action==='lock'?'LOCK SITE':action==='unlock'?'UNLOCK SITE':
      action==='reset_week_group'?'RESET '+group:'ARCHIVE '+group;
    const dialog=by('admin-system-confirm');
    by('admin-system-confirm-form').reset();
    by('admin-system-confirm-form').dataset.action=action;
    setText('admin-system-confirm-title',action==='lock'?'Lock Site':
      action==='unlock'?'Unlock Site':
      action==='reset_week_group'?'Reset '+group:'Archive & Zero '+group);
    setText('admin-system-confirm-impact',isLock
      ?(action==='lock'?'MTI, Airman and Squadron access will be blocked. Admin access remains available.':
        'Existing users can access GATE again.')
      :(action==='reset_week_group'
        ?'The current operational data will be preserved in immutable recovery evidence, then cleared. Original Input dorm configuration will be restored.'
        :'The current operational data will be saved as an immutable historical archive. All active receiving state will be cleared.'));
    setText('admin-system-confirm-label','Type exactly: '+label);
    by('admin-system-confirm-form').elements.confirmation.placeholder=label;
    status('admin-system-confirm-status','');
    dialog.showModal();
  }
  async function submit(event){
    event.preventDefault();
    if(requestInFlight)return;
    const form=event.currentTarget,action=form.dataset.action,
      confirmation=form.elements.confirmation.value.trim(),reason=form.elements.reason.value.trim();
    const required=action==='lock'?'LOCK SITE':action==='unlock'?'UNLOCK SITE':
      action==='reset_week_group'?'RESET '+recovery?.week_group:'ARCHIVE '+recovery?.week_group;
    if(confirmation!==required){status('admin-system-confirm-status','Confirmation does not match.',true);return;}
    if(reason.length<10||reason.length>1000){status('admin-system-confirm-status','Reason must contain 10–1000 characters.',true);return;}
    const siteAction=action==='lock'||action==='unlock';
    const path=siteAction?'/api/admin-system':'/api/admin-recovery';
    const payload={action,operationId:crypto.randomUUID(),confirmation,reason};
    if(siteAction)payload.expectedRevision=lock.revision;
    else Object.assign(payload,{expectedWeekGroup:recovery.week_group,
      expectedCycleId:recovery.cycle_id,expectedRevision:recovery.cycle_revision});
    requestInFlight=true;disabled('admin-system-confirm-submit',true);
    status('admin-system-confirm-status','Submitting authenticated operation…');
    try {
      const result=await api(path,{method:'POST',headers:{
        'Content-Type':'application/json','Origin':location.origin
      },body:JSON.stringify(payload)});
      status('admin-system-action-status','Verified '+action+' · Operation ID '+result.operationId);
      by('admin-system-confirm').close();
      await loadLock();await loadRecovery();
    }catch(error){
      status('admin-system-confirm-status',
        'Operation not confirmed: '+error.message+'. Refresh authoritative state before retrying.',true);
      await loadLock();await loadRecovery();
    }finally{requestInFlight=false;disabled('admin-system-confirm-submit',false);}
  }

  by('site-lock-button')?.addEventListener('click',()=>openConfirmation(by('site-lock-button').dataset.action));
  by('admin-reset-week')?.addEventListener('click',()=>openConfirmation('reset_week_group'));
  by('admin-archive-zero')?.addEventListener('click',()=>openConfirmation('archive_and_zero'));
  by('admin-system-confirm-form')?.addEventListener('submit',submit);
  by('admin-system-confirm-cancel')?.addEventListener('click',()=>by('admin-system-confirm').close());
  by('admin-system-refresh')?.addEventListener('click',async()=>{await loadLock();await loadRecovery();});
  loadLock().then(loadRecovery);
})();
