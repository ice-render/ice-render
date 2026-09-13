/**
 * @see https://www.w3resource.com/javascript-exercises/javascript-math-exercise-23.php
 */
import root from '../cross-platform/root';

export function uuid(): string {
  // 优先使用运行时原生实现。randomUUID 只在安全上下文（HTTPS / localhost）提供，
  // jsdom、部分小程序环境只有 crypto.getRandomValues，必须继续降级，不能直接抛错。
  if (root.crypto && typeof root.crypto.randomUUID === 'function') {
    return root.crypto.randomUUID();
  }
  if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    root.crypto.getRandomValues(bytes);
    // RFC 4122 version 4 + variant 10xx
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      hex.push((bytes[i] + 0x100).toString(16).slice(1));
    }
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    );
  }
  // 最后的兼容兜底：无 crypto 的旧运行时 / 小程序基础库。
  let dt = Date.now();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = ((dt + Math.random() * 16) % 16) | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}
