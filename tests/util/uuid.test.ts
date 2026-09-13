/**
 * uuid 运行时兼容回归。
 *
 * 部分环境（Jest jsdom、小程序基础库、非安全上下文）没有 randomUUID；
 * 组件构造依赖 uuid，不能在缺能力时直接抛错，也不能退化成不合法格式。
 */
import root from '../../src/cross-platform/root';
import { uuid } from '../../src/util/uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('util.uuid 运行时兼容', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(root, 'crypto');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(root, 'crypto', originalDescriptor);
    } else {
      delete root.crypto;
    }
  });

  function setCrypto(value: any) {
    Object.defineProperty(root, 'crypto', {
      value,
      writable: true,
      configurable: true,
    });
  }

  it('优先使用 crypto.randomUUID', () => {
    setCrypto({ randomUUID: () => 'from-random-uuid' });
    expect(uuid()).toBe('from-random-uuid');
  });

  it('randomUUID 缺失时用 crypto.getRandomValues 生成合法 v4', () => {
    let seed = 0;
    setCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = seed++;
        return bytes;
      },
    });
    expect(uuid()).toMatch(UUID_V4);
  });

  it('crypto 完全缺失时走本地兜底，仍生成合法 v4 形态', () => {
    setCrypto(undefined);
    expect(uuid()).toMatch(UUID_V4);
  });
});
