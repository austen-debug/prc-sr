import { readSiteLock, siteLockJson } from './site-lock-core.mjs';

export async function onRequestGet({env,data}) {
  const role=String(data?.session?.role||'');
  if (!['admin','instructor','airman','squadron'].includes(role))
    return siteLockJson({isOk:false,code:'unauthorized'},401);
  try {
    const lock=await readSiteLock(env);
    return siteLockJson({isOk:true,locked:lock.locked,revision:lock.revision,installed:lock.installed});
  } catch {
    return siteLockJson({isOk:false,code:'site_lock_unavailable'},503);
  }
}
export async function onRequestPost(){return siteLockJson({isOk:false,code:'method_not_allowed'},405);}
