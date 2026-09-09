import root from '../../src/cross-platform/root';

describe('字体加载平台适配（root.loadFont）', () => {
  afterEach(() => {
    delete (global as any).wx;
  });

  it('无 FontFace / wx 环境返回 resolved Promise（兜底）', async () => {
    await expect(root.loadFont('MyFont', 'url')).resolves.toBeUndefined();
  });

  it('有 wx.loadFont 时转发到小程序 API', async () => {
    const loadFont = jest.fn().mockResolvedValue('loaded');
    (global as any).wx = { loadFont };
    await root.loadFont('MyFont', '/path/font.ttf');
    expect(loadFont).toHaveBeenCalledWith('/path/font.ttf');
  });
});
