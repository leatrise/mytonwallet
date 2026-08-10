import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContentProxyError, isPublicIpAddress, parseExternalUrl } from './contentProxy.js';

void describe('content proxy boundary', () => {
  void it('accepts only unauthenticated HTTP URLs', () => {
    assert.equal(parseExternalUrl('https://example.com/metadata.json').hostname, 'example.com');
    assert.throws(() => parseExternalUrl('file:///etc/passwd'), ContentProxyError);
    assert.throws(() => parseExternalUrl('https://user:pass@example.com/private'), ContentProxyError);
  });

  void it('rejects private and reserved IP address ranges', () => {
    for (const address of [
      '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.1.1',
      '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '::', '::1',
      'fc00::1', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1',
      '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::c0a8:101',
    ]) assert.equal(isPublicIpAddress(address), false, address);
    assert.equal(isPublicIpAddress('1.1.1.1'), true);
    assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
  });
});
