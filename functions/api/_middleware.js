import { verifyRequestSession } from './session-contract.mjs';

export async function onRequest(context) {
  const session = await verifyRequestSession(context.request, context.env);
  if (session) {
    context.data.session = session;
  }
  return context.next();
}
