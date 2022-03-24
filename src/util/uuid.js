/**
 * @see https://www.w3resource.com/javascript-exercises/javascript-math-exercise-23.php
 */
import root from '../cross-platform/root';

export function uuid() {
  if (root.crypto) {
    return root.crypto.randomUUID();
  } else {
    var dt = Date.now();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    return uuid;
  }
}
