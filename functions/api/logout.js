const COOKIE_NAME = 'prc_sr_session';

export function onRequestPost() {
  return new Response(JSON.stringify({
    isOk: true
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}
