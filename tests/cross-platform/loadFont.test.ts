import root from '../../src/cross-platform/root';

describe('字体加载平台适配（root.loadFont）', () => {
  it('无 FontFace 环境返回 resolved Promise（headless / 测试桩兜底）', async () => {
    await expect(root.loadFont('MyFont', 'url')).resolves.toBeUndefined();
  });

  it('有 FontFace + document.fonts 时走浏览器字体加载', async () => {
    const load = jest.fn().mockResolvedValue('loaded');
    const add = jest.fn();
    (global as any).FontFace = class {
      constructor(
        public family: string,
        public source: string
      ) {}
      load = load;
    };
    (global as any).document = { fonts: { add } };
    try {
      await root.loadFont('MyFont', 'url');
      expect(add).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      delete (global as any).FontFace;
      delete (global as any).document;
    }
  });
});
