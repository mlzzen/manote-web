/**
 * UUID v4。优先用 crypto.randomUUID（浏览器与 Node 18+ 都有），
 * 缺失时退回 getRandomValues 拼一个，再退回时间戳 + 随机数。
 */
export function newId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((it) => it.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  const stamp = Date.now().toString(16).padStart(12, '0')
  const rand = Math.random().toString(16).slice(2, 14).padEnd(12, '0')
  return `${stamp.slice(0, 8)}-${stamp.slice(8, 12)}-4${rand.slice(0, 3)}-a${rand.slice(3, 6)}-${rand.slice(6, 12)}${rand.slice(0, 6)}`
}

/** 规范形式的 UUID（8-4-4-4-12），大小写不敏感。 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCanonicalUuid(id: string): boolean {
  return UUID_PATTERN.test(id)
}
