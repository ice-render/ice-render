import ICEImage from '../../src/graphic/ICEImage';

describe('ICEImage 雪碧图裁剪', () => {
  it('默认 sx/sy/sw/sh = 0（整图缩放，不做裁剪）', () => {
    const img = new ICEImage({});
    expect(img.state.sx).toBe(0);
    expect(img.state.sy).toBe(0);
    expect(img.state.sw).toBe(0);
    expect(img.state.sh).toBe(0);
  });

  it('雪碧图参数透传（sx/sy/sw/sh）', () => {
    const img = new ICEImage({ sx: 32, sy: 0, sw: 32, sh: 32 });
    expect(img.state.sx).toBe(32);
    expect(img.state.sy).toBe(0);
    expect(img.state.sw).toBe(32);
    expect(img.state.sh).toBe(32);
  });

  it('只给 sw/sh 不给 sx/sy：默认从原点开始裁剪', () => {
    const img = new ICEImage({ sw: 64, sh: 64 });
    expect(img.state.sx).toBe(0);
    expect(img.state.sy).toBe(0);
    expect(img.state.sw).toBe(64);
    expect(img.state.sh).toBe(64);
  });

  it('雪碧图 + 圆形裁剪可组合（头像图集）', () => {
    const img = new ICEImage({ sx: 0, sy: 0, sw: 50, sh: 50, clipType: 'circle' });
    expect(img.state.sw).toBe(50);
    expect(img.state.clipType).toBe('circle');
  });
});
