export function onRequestGet() {
  return new Response(JSON.stringify({
    isOk: true,
    message: 'PRC-SR API is alive'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
