'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isExcludedVirtualServerName, buildMessage } = require('../infrastructureSync.js');

test('isExcludedVirtualServerName: имя с префиксом vm- исключается без учёта регистра и пробелов', () => {
  for (const name of ['vm-01', 'VM-KUBE-1', ' vm-test ', 'Vm-']) {
    assert.equal(isExcludedVirtualServerName(name), true, String(name));
  }
});

test('isExcludedVirtualServerName: vm без дефиса и префикс не в начале не исключаются', () => {
  for (const name of ['vm', 'vm_01', 'server-vm-1', 'vmserver', 'kvm-host', '', null, undefined]) {
    assert.equal(isExcludedVirtualServerName(name), false, String(name));
  }
});

test('buildMessage: пропущенные vm- попадают в сводку только когда они есть', () => {
  const base = {
    vms_fetched: 3,
    devices_fetched: 2,
    created: 1,
    updated: 2,
    deleted: 0,
    relations_synced: 4,
    unmatched_codes: [],
  };
  assert.doesNotMatch(buildMessage({ ...base, skipped: 0 }), /пропущено/);
  assert.match(buildMessage({ ...base, skipped: 2 }), /пропущено vm- 2/);
});
