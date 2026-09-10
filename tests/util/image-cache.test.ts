import ImageCache from '../../src/util/ImageCache';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  class FakeImage {
    complete = false;
    naturalWidth = 0;
    src = '';
    onload = null;
    onerror = null;
  }
  return {
    __esModule: true,
    default: {
      createPath2D: () => new PolyfillPath2D(),
      createImage: () => new FakeImage(),
    },
  };
});

describe('ImageCache 跨平台图片构造', () => {
  it('通过 root.createImage 创建图片，而非直接依赖全局 Image', () => {
    const cache = new ImageCache({ root: {}, dirty: false } as any);
    const { image } = cache.setImage('http://example.com/a.png');
    expect(image).toBeTruthy();
    expect((image as any).constructor.name).toBe('FakeImage');
  });
});
