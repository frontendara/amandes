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
import eventEmitter from 'minimal-event-emitter';
import NetworkError from '../NetworkError';
import WorkPool from '../collections/WorkPool';
import chain from '../util/chain';
import delay from '../util/delay';
import now from '../util/now';
import { Rect, Source, Tile } from '../jsdoc-extras';

// Map template properties to their corresponding tile properties.
const templateProperties = {
  x: 'x',
  y: 'y',
  z: 'z',
  f: 'face',
} as const;

// Default face order for cube maps.
const defaultCubeMapFaceOrder = 'bdflru';

// Default maximum number of concurrent requests.
const defaultConcurrency = 4;

// Default milliseconds to wait before retrying failed requests.
const defaultRetryDelay = 10000;

interface ImageUrlSourceOptions {
  /**
   * @param {number} [opts.concurrency=4] Maximum number of tiles to request at
   * the same time. The limit is per {@link ImageSourceUrl} instance.
   */
  concurrency?: number;
  /**
   * @param {number} [opts.retryDelay=10000] Time in milliseconds to wait before
   * retrying a failed request.
   */
  retryDelay?: number;
}

/**
 * @class ImageUrlSource
 * @implements Source
 * @classdesc
 *
 * A {@link Source} that loads {@link Asset assets} from images given a URL and
 * a crop rectangle.
 *
 * @param {Function} sourceFromTile Function that receives a tile and returns
 * a `{ url, rect }` object, where `url` is an image URL and `rect`, when
 * present, is an `{ x, y, width, height }` object in normalized coordinates
 * denoting the portion of the image to use.
 */
class ImageUrlSource implements Source {
  #loadPool: WorkPool;
  #retryDelay: any;
  #retryMap: {};
  #sourceFromTile: any;

  constructor(
    sourceFromTile: (
      tile: Tile & { face: string; x: number; y: number; z: number }
    ) => { url?: string; rect?: Required<Rect> },
    opts?: ImageUrlSourceOptions
  ) {
    opts = opts ? opts : {};

    this.#loadPool = new WorkPool({
      concurrency: opts.concurrency || defaultConcurrency,
    });

    this.#retryDelay = opts.retryDelay || defaultRetryDelay;
    this.#retryMap = {};

    this.#sourceFromTile = sourceFromTile;
  }
  loadAsset(stage, tile, done) {
    const retryDelay = this.#retryDelay;
    const retryMap = this.#retryMap;

    const tileSource = this.#sourceFromTile(tile);
    const url = tileSource.url;
    const rect = tileSource.rect;

    const loadImage = stage.loadImage.bind(stage, url, rect);

    const loadFn = (done) => {
      // TODO: Deduplicate load requests for the same URL. Although the browser
      // might be smart enough to avoid duplicate requests, they are still unduly
      // impacted by the concurrency parameter.
      return this.#loadPool.push(loadImage, (err, asset) => {
        if (err) {
          if (err instanceof NetworkError) {
            // If a network error occurred, wait before retrying.
            retryMap[url] = now();
            this.emit('networkError', err, tile);
          }
          done(err, tile);
        } else {
          // On a successful fetch, forget the previous timeout.
          delete retryMap[url];
          done(null, tile, asset);
        }
      });
    };

    // Check whether we are retrying a failed request.
    let delayAmount;
    const lastTime = retryMap[url];
    if (lastTime != null) {
      const currentTime = now();
      const elapsed = currentTime - lastTime;
      if (elapsed < retryDelay) {
        // Wait before retrying.
        delayAmount = retryDelay - elapsed;
      } else {
        // Retry timeout expired; perform the request at once.
        delayAmount = 0;
        delete retryMap[url];
      }
    }

    const delayFn = delay.bind(null, delayAmount);

    return chain(delayFn, loadFn)(done);
  }
  emit(_arg0: string, _err: NetworkError, _tile: any) {
    throw new Error('Method not implemented.');
  }
  /**
   * Creates an ImageUrlSource from a string template.
   *
   * @param url Tile URL template, which may contain the following
   *    placeholders:
   *    - `{f}` : tile face (one of `b`, `d`, `f`, `l`, `r`, `u`)
   *    - `{z}` : tile level index (0 is the smallest level)
   *    - `{x}` : tile horizontal index
   *    - `{y}` : tile vertical index
   * @param [opts] In addition to the options already supported by the
   *     {@link ImageUrlSource} constructor.
   * @param {String} opts.cubeMapPreviewUrl URL to use as the preview level.
   *     This must be a single image containing six cube faces laid out
   *     vertically according to the face order parameter.
   * @param {String} [opts.cubeMapPreviewFaceOrder='bdflru'] Face order within
   *     the preview image.
   */
  static fromString(
    url: string,
    opts?: {
      cubeMapPreviewFaceOrder?: string;
      cubeMapPreviewUrl: string;
    } & ImageUrlSourceOptions
  ) {
    const faceOrder =
      (opts && opts?.cubeMapPreviewFaceOrder) || defaultCubeMapFaceOrder;

    const urlFn = opts?.cubeMapPreviewUrl ? withPreview : withoutPreview;

    return new ImageUrlSource(urlFn, opts);

    function withoutPreview(tile) {
      let tileUrl = url;

      for (const property in templateProperties) {
        const templateProperty = templateProperties[property];
        const regExp = propertyRegExp(property);
        const valueFromTile = tile.hasOwnProperty(templateProperty)
          ? tile[templateProperty]
          : '';
        tileUrl = tileUrl.replace(regExp, valueFromTile);
      }

      return { url: tileUrl };
    }

    function withPreview(tile) {
      if (tile.z === 0) {
        return cubeMapUrl(tile);
      } else {
        return withoutPreview(tile);
      }
    }

    function cubeMapUrl(tile) {
      const y = faceOrder.indexOf(tile.face) / 6;
      return {
        url: opts?.cubeMapPreviewUrl,
        rect: { x: 0, y: y, width: 1, height: 1 / 6 },
      };
    }
  }
}

eventEmitter(ImageUrlSource);

function propertyRegExp(property) {
  const regExpStr = '\\{(' + property + ')\\}';
  return new RegExp(regExpStr, 'g');
}

export default ImageUrlSource;
