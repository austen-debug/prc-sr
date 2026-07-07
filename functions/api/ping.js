export function onRequestGet() {
  return new Response(JSON.stringify({
    isOk: true,
    message: 'GATE API is alive'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
