import global from "../util/global";
import eventEmitter from "minimal-event-emitter";
import clearOwnProperties from "../util/clearOwnProperties";

var propertyMap = {
  HTMLImageElement: ['naturalWidth', 'naturalHeight'],
  HTMLCanvasElement: ['width', 'height'],
  ImageBitmap: ['width', 'height']
};

/**
 * @class StaticAsset
 * @implements Asset
 * @classdesc
 *
 * An {@link Asset} whose pixel contents never change.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} element The
 *     underlying pixel source.
 * @throws If the pixel source is unsupported.
 */
class StaticAsset {
  #widthProp: any;
  #heightProp: any;
  #element: any;

  constructor(element) {
    var supported = false;
    for (var type in propertyMap) {
      if (global?.[type] && element instanceof global[type]) {
        supported = true;
        this.#widthProp = propertyMap[type][0];
        this.#heightProp = propertyMap[type][1];
        break;
      }
    }
    if (!supported) {
      throw new Error('Unsupported pixel source');
    }

    this.#element = element;
  }
  /**
   * Destructor.
   */
  destroy() {
    clearOwnProperties(this);
  }
  element() {
    return this.#element;
  }
  width() {
    return this.#element[this.#widthProp];
  }
  height() {
    return this.#element[this.#heightProp];
  }
  timestamp() {
    return 0;
  }
  isDynamic() {
    return false;
  }
}

eventEmitter(StaticAsset);

export default StaticAsset;
