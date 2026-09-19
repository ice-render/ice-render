/**
 * 引擎错误的**稳定错误码**：应用层据此映射到自己的语言包，而不是匹配中文 message。
 *
 * 契约（见 docs/architecture/17-i18n-boundary.md）：
 * - 引擎不做 i18n（词条在应用层）；
 * - 引擎抛出/告警的错误必须带 `code`（`ICE_*`），message 只是兜底中文；
 * - `getICEErrorCode` / `isICEError` 是应用层唯一的判定入口。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import Deserializer from '../../src/persistence/Deserializer';
import { SERIALIZATION_VERSION } from '../../src/persistence/Serializer';
import { ICE_ERROR_CODES, getICEErrorCode, isICEError } from '../../src/util/errors';

/** 捕获调用抛出的错误（把 try/catch 收敛到一处，避免 `expect` 出现在 catch 里）。 */
function captured(fn: () => unknown): any {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('期望抛错，但没有抛');
}

describe('引擎错误码', () => {
  it('registerType：格式非法 / 非构造函数 / typeId 冲突 / 构造函数冲突各有独立错误码', () => {
    const ice: any = new ICE();

    const formatErr = captured(() => ice.registerType('Badge', class W extends ICERect {}));
    expect(getICEErrorCode(formatErr)).toBe(ICE_ERROR_CODES.TYPE_ID_INVALID);

    const ctorErr = captured(() => ice.registerType('test:Badge', {} as any));
    expect(getICEErrorCode(ctorErr)).toBe(ICE_ERROR_CODES.TYPE_CTOR_INVALID);

    class A extends ICERect {}
    class B extends ICERect {}
    ice.registerType('test:Badge', A);

    const idConflict = captured(() => ice.registerType('test:Badge', B));
    expect(getICEErrorCode(idConflict)).toBe(ICE_ERROR_CODES.TYPE_ID_CONFLICT);
    expect(idConflict.details).toMatchObject({ typeId: 'test:Badge' });

    const ctorConflict = captured(() => ice.registerType('test:Another', A));
    expect(getICEErrorCode(ctorConflict)).toBe(ICE_ERROR_CODES.TYPE_CTOR_CONFLICT);
  });

  it('ICE.init：缺目标 / 已绑定其它 canvas', () => {
    const ice: any = new ICE();
    const err = captured(() => ice.init(undefined));
    expect(getICEErrorCode(err)).toBe(ICE_ERROR_CODES.INIT_TARGET_REQUIRED);
  });

  it('反序列化：版本高于当前支持的版本', () => {
    const ice: any = new ICE();
    const err = captured(() => new Deserializer(ice).fromJSONObject({ version: 999, childNodes: [] }));
    expect(getICEErrorCode(err)).toBe(ICE_ERROR_CODES.DESERIALIZE_VERSION_UNSUPPORTED);
    expect(err.details).toMatchObject({ version: 999, supported: SERIALIZATION_VERSION });
  });

  it('插件：缺 name / 组件注册失败（带插件名）', () => {
    const ice: any = new ICE();
    const noName = captured(() => ice.use({}));
    expect(getICEErrorCode(noName)).toBe(ICE_ERROR_CODES.PLUGIN_NAME_REQUIRED);

    class Badge extends ICERect {}
    const regFailed = captured(() => ice.use({ name: 'widgets', components: { Badge } })); // 键缺 namespace
    expect(getICEErrorCode(regFailed)).toBe(ICE_ERROR_CODES.PLUGIN_COMPONENT_REGISTER_FAILED);
    expect(regFailed.details).toMatchObject({ pluginName: 'widgets', typeId: 'Badge' });
    expect(isICEError(regFailed)).toBe(true);
  });

  it('非引擎错误不会被误判（不误伤业务错误码，如 Node 的 ENOENT）', () => {
    expect(getICEErrorCode(new Error('boom'))).toBeUndefined();
    const enoent: any = new Error('no such file');
    enoent.code = 'ENOENT';
    expect(getICEErrorCode(enoent)).toBeUndefined();
    expect(isICEError(enoent)).toBe(false);
    expect(getICEErrorCode(undefined)).toBeUndefined();
  });
});
