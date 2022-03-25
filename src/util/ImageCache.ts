import ICE from '../ICE';

/**
 * @class ImageCache
 * 图片缓存类
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ImageCache {
  private ice: ICE;
  public static readonly CACHE_SIZE = 100;
  public imageCache = new Map();

  constructor(ice: ICE) {
    this.ice = ice;
  }

  public setImage(url: string) {
    let image = this.imageCache.get(url);
    if (!image) {
      image = new Image();
      image.onload = () => {
        this.ice._dirty = true;
      };
      image.onerror = () => {
        console.error('ImageCache: 图片加载失败：', url);
      };
      image.src = url;
      if (this.imageCache.size > ImageCache.CACHE_SIZE) {
        this.imageCache.delete(this.imageCache.keys().next().value);
      }
      this.imageCache.set(url, image);
    }
    return { loaded: this.loaded(image), image };
  }

  private loaded(image) {
    return image.complete && image.naturalWidth > 0;
  }
}
