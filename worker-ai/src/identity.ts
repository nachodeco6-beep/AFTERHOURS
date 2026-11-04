/** Who a request counts against: the browser's clientId and a key derived from its IP. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isClientId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

/**
 * IPv4 as is; IPv6 by its /64, because one connection usually gets a whole /64 and could change
 * address on every request. Without an IP everyone shares one bucket, so it is no way around the cap.
 */
export function ipBucket(raw: string | null): string {
  const ip = raw?.trim().toLowerCase()
  if (!ip) return 'unknown'
  if (!ip.includes(':')) return ip

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)
  if (mapped) return mapped[1]

  const [head, tail] = ip.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const zeros = new Array<string>(Math.max(0, 8 - headParts.length - tailParts.length)).fill('0')
  const hextets = [...headParts, ...zeros, ...tailParts].slice(0, 4)
  return `${hextets.map((part) => parseInt(part, 16).toString(16)).join(':')}::/64`
}

/** HMAC, not a plain hash: without the secret, every IPv4 could be tried until one matches. */
export async function ipKey(raw: string | null, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ipBucket(raw)))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
