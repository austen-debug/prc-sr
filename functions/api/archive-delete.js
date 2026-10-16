// Retired legacy physical-delete path. Historical archives are administered through
// /api/admin-archives dispositions by a verified Admin session only.
const gone=()=>new Response(JSON.stringify({isOk:false,code:'retired',error:'Use Admin archive disposition workflow.'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost(){return gone();}
export async function onRequestDelete(){return gone();}
export async function onRequestGet(){return gone();}
