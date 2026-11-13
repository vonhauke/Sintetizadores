import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInternalUrl, windowKey } from '../electron/windows.js';

test('isInternalUrl aceita só file:// dentro da raiz', () => {
  assert.equal(isInternalUrl('file:///app/101/index.html', '/app'), true);
  assert.equal(isInternalUrl('file:///app/index.html#x', '/app'), true);
  assert.equal(isInternalUrl('https://example.com', '/app'), false);
  assert.equal(isInternalUrl('file:///outra/x.html', '/app'), false);
  assert.equal(isInternalUrl('file:///app/../etc/x', '/app'), false);
  assert.equal(isInternalUrl('file:///appx/y.html', '/app'), false);
  assert.equal(isInternalUrl('lixo', '/app'), false);
});

test('isInternalUrl com raiz estilo Windows', () => {
  assert.equal(isInternalUrl('file:///C:/Users/p/app/303/index.html', ['C:','Users','p','app'].join(String.fromCharCode(92))), true);
  assert.equal(isInternalUrl('file:///C:/Users/p/outro/x.html', ['C:','Users','p','app'].join(String.fromCharCode(92))), false);
});

test('windowKey ignora hash e query', () => {
  assert.equal(windowKey('file:///app/101/index.html'), windowKey('file:///app/101/index.html#x'));
  assert.equal(windowKey('file:///app/101/index.html?a=1'), windowKey('file:///app/101/index.html'));
  assert.notEqual(windowKey('file:///app/101/index.html'), windowKey('file:///app/106/index.html'));
});
