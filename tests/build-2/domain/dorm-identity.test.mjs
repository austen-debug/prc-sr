import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDormIdentity,
  findDuplicateDormIdentity
} from '../../../public/app/domain/index.mjs';

const dorm = (sdq, name, extra = {}) => ({
  type: 'dorm',
  schemaVersion: 'build-2.dorm.v1',
  payload: { sdq, name, ...extra }
});

test('same dorm name is allowed when squadrons differ', () => {
  assert.equal(findDuplicateDormIdentity([dorm('324', 'A04'), dorm('326', 'A04')]), null);
});

test('same squadron and dorm combination is rejected', () => {
  assert.deepEqual(findDuplicateDormIdentity([dorm('324', 'A04'), dorm('324', 'A04')]), {
    squadron: '324', dorm: 'A04', key: '324::A04'
  });
});

test('composite identity comparison is case and whitespace insensitive', () => {
  const duplicate = findDuplicateDormIdentity([dorm(' 324 ', ' a04 '), dorm('324', 'A04')]);
  assert.equal(duplicate?.key, '324::A04');
});

test('different dorms in the same squadron remain valid', () => {
  assert.equal(findDuplicateDormIdentity([dorm('324', 'A04'), dorm('324', 'A05')]), null);
});

test('unnamed canonical input rows retain deterministic row-based identities', () => {
  assert.deepEqual(createDormIdentity({ sdq: '324', rowIndex: 0 }), {
    squadron: '324', dorm: 'DORM 1', key: '324::DORM 1'
  });
  assert.deepEqual(createDormIdentity({ sdq: '324', rowIndex: 1 }), {
    squadron: '324', dorm: 'DORM 2', key: '324::DORM 2'
  });
});
