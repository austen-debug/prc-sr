import { createShellState, reduceShellState, validateShellState } from './shell-state.mjs';

export function createShellStore(initialState = {}) {
  let state = createShellState(initialState);
  const subscribers = new Set();

  function getState() {
    return state;
  }

  function dispatch(event) {
    const next = reduceShellState(state, event);
    const validation = validateShellState(next);
    if (!validation.valid) {
      throw new Error(`Invalid shell state: ${validation.errors.join(' ')}`);
    }
    if (next === state) return state;
    const previous = state;
    state = next;
    subscribers.forEach(subscriber => subscriber(state, previous, event));
    return state;
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== 'function') throw new TypeError('Shell subscriber must be a function.');
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return Object.freeze({ getState, dispatch, subscribe });
}
