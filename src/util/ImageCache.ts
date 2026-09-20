import ICE from '../ICE';
import root from '../cross-platform/root';
import { notifyImageRequest } from '../worker/mirror-hooks';

/**
 * @class ImageCache 图片缓存器
 *
 * 以图片的 url 作为 key，图片对象作为 value，缓存图片。
 *
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
      /**
       * ① **镜像下发过的图**（worker 侧）：宿主已经在主线程解码好、随 `images` 消息零拷贝过来的
       * `ImageBitmap` —— 直接当缓存用（它没有 `complete` / `naturalWidth`，所以走下面的短路径返回
       * "已加载"）。这一步必须排在 `root.createImage()` 之前：worker 里没有 `Image` 构造器。
       */
      const mirrored = mirroredImageOf(this.ice, url);
      if (mirrored) {
        this.imageCache.set(url, mirrored);
        return { loaded: true, image: mirrored };
      }
      /**
       * ② 常规路径（浏览器主线程）：`Image` + `onload`。**同时告诉镜像宿主**"这棵树用到这张图" ——
       * 宿主解码后下发给 worker（见 `MirrorHost`）。没有装桥时这一步是零成本。
       */
      notifyImageRequest(this.ice, url);
      try {
        image = root.createImage();
      } catch (e) {
        /**
         * worker 里没有 `Image` 构造器、图又还没下发：返回"未加载"，**不抛**。
         * 抛出去会把整帧渲染打断 → 兼容层回退主线程（等于镜像白开）；而"少一张图"只是暂时现象，
         * 下发到达时 `MirrorTarget.applyImages()` 会把用到它的组件标脏、下一帧就补上。
         */
        return { loaded: false, image: null };
      }
      image.onload = () => {
        this.ice.dirty = true;
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
    if (!image) {
      return false;
    }
    /**
     * 镜像下发过来的 `ImageBitmap` **没有** `complete` / `naturalWidth` —— 它本来就是解码好的位图。
     * 用 `Image` 那套判定会得到 `undefined`（falsy），症状是：**第一次**取用能画（走的是"下发过的图"
     * 那条短路径），缓存命中之后的每一次都画不出来（实测：图标只出现一帧就没了 / 干脆没有）。
     */
    if (!('complete' in image)) {
      return true;
    }
    return image.complete && image.naturalWidth > 0;
  }
}

/** 镜像下发过来的位图：挂在冰实例上的注册表（由 `MirrorTarget.applyImages` 维护）。 */
function mirroredImageOf(ice: any, url: string): any {
  const registry: any = ice && ice.__mirrorImages;
  return registry && typeof registry.get === 'function' ? registry.get(url) || null : null;
}
