import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ipBucket, ipKey, isClientId } from '../src/identity.ts'

test('a clientId has to be a UUID', () => {
  assert.equal(isClientId('11111111-1111-4111-8111-111111111111'), true)
  assert.equal(isClientId('ABCDEF12-1111-4111-8111-111111111111'), true)
  for (const bad of [undefined, null, 1, '', 'hola', '11111111-1111-4111-8111-11111111111', '11111111-1111-4111-8111-1111111111111', ' 11111111-1111-4111-8111-111111111111', '11111111111141118111111111111111', 'g1111111-1111-4111-8111-111111111111']) {
    assert.equal(isClientId(bad), false, String(bad))
  }
})

test('an IPv4 is its own bucket', () => {
  assert.equal(ipBucket('203.0.113.7'), '203.0.113.7')
  assert.equal(ipBucket(' 203.0.113.7 '), '203.0.113.7')
  assert.equal(ipBucket('::ffff:203.0.113.7'), '203.0.113.7', 'la misma IPv4 escrita como IPv6')
  assert.equal(ipBucket('::FFFF:203.0.113.7'), '203.0.113.7', 'también en mayúsculas')
})

test('IPv6 addresses of the same /64 share a bucket, however they are written', () => {
  const bucket = '2001:db8:1:2::/64'
  assert.equal(ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), bucket)
  assert.equal(ipBucket('2001:0DB8:0001:0002:1:2:3:4'), bucket)
  assert.equal(ipBucket('2001:db8:1:2::1'), bucket)
  assert.equal(ipBucket('2001:db8:1:2::'), bucket)
})

test('IPv6 addresses of different /64 do not', () => {
  assert.notEqual(ipBucket('2001:db8:1:2::1'), ipBucket('2001:db8:1:3::1'))
  assert.equal(ipBucket('2001:db8::1'), '2001:db8:0:0::/64', 'el :: expande ceros en el prefijo')
  assert.equal(ipBucket('::1'), '0:0:0:0::/64')
})

test('without an IP everyone shares one bucket', () => {
  for (const missing of [null, '', '   ']) assert.equal(ipBucket(missing), 'unknown')
})

test('the key does not contain the IP, and depends on the secret and the bucket', async () => {
  const key = await ipKey('203.0.113.7', 'secreto-a')
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.equal(key, await ipKey('203.0.113.7', 'secreto-a'), 'estable')
  assert.notEqual(key, await ipKey('203.0.113.7', 'secreto-b'), 'depende del secreto')
  assert.notEqual(key, await ipKey('203.0.113.8', 'secreto-a'), 'depende de la IP')
  assert.equal(await ipKey('2001:db8:1:2::1', 's'), await ipKey('2001:db8:1:2::2', 's'), 'misma /64, misma clave')
})
