/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import global from "../util/global";
import eventEmitter from "minimal-event-emitter";
import clearOwnProperties from "../util/clearOwnProperties";

const propertyMap = {
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
    let supported = false;
    for (const type in propertyMap) {
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
