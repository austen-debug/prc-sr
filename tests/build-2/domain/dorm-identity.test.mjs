import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDormIdentity,
  findDuplicateDormIdentity
} from '../../../public/app/domain/index.mjs';

test('same dorm name is allowed when squadrons differ', () => {
  const duplicate = findDuplicateDormIdentity([
    { sdq: '324', dorm_name: 'A04' },
    { sdq: '326', dorm_name: 'A04' }
  ]);

  assert.equal(duplicate, null);
});

test('same squadron and dorm combination is rejected', () => {
  const duplicate = findDuplicateDormIdentity([
    { sdq: '324', dorm_name: 'A04' },
    { sdq: '324', dorm_name: 'A04' }
  ]);

  assert.deepEqual(duplicate, {
    squadron: '324',
    dorm: 'A04',
    key: '324::A04'
  });
});

test('composite identity comparison is case and whitespace insensitive', () => {
  const duplicate = findDuplicateDormIdentity([
    { squadron: ' 324 ', dormName: ' a04 ' },
    { sdq: '324', dorm_name: 'A04' }
  ]);

  assert.equal(duplicate?.key, '324::A04');
});

test('different dorms in the same squadron remain valid', () => {
  const duplicate = findDuplicateDormIdentity([
    { sdq: '324', dorm_name: 'A04' },
    { sdq: '324', dorm_name: 'A05' }
  ]);

  assert.equal(duplicate, null);
});

test('unnamed input rows retain deterministic row-based identities', () => {
  assert.deepEqual(createDormIdentity({ sdq: '324', rowIndex: 0 }), {
    squadron: '324',
    dorm: 'DORM 1',
    key: '324::DORM 1'
  });
  assert.deepEqual(createDormIdentity({ sdq: '324', rowIndex: 1 }), {
    squadron: '324',
    dorm: 'DORM 2',
    key: '324::DORM 2'
  });
});
