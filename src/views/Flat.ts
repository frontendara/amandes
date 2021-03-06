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
import { mat4 as mat4 } from 'gl-matrix';
import { vec4 as vec4 } from 'gl-matrix';
import pixelRatio from '../util/pixelRatio';
import real from '../util/real';
import clamp from '../util/clamp';
import clearOwnProperties from '../util/clearOwnProperties';

// Default viewport dimensions.
// Start with zero to ensure that those values are handled correctly.
const defaultWidth = 0;
const defaultHeight = 0;

// Default view parameters.
const defaultX = 0.5;
const defaultY = 0.5;
const defaultZoom = 1;

// Constant values used to simplify the frustum culling logic.
// planeAxes[i] indicates the coordinate value that defines a frustum plane.
// planeCmp[i] indicates how point and plane coordinates should be compared
// to determine whether the point is on the outer side of the plane.
const planeAxes = [
  1, // top
  0, // right
  1, // bottom
  0, // left
];
const planeCmp = [
  -1, // top
  -1, // right
  1, // bottom
  1, // left
];

// A zoom of exactly 0 breaks some computations, so we force a minimum positive
// value. We use 6 decimal places for the epsilon value to avoid broken
// rendering due to loss of precision in floating point computations.
const zoomLimitEpsilon = 0.000001;

/**
 * @interface FlatViewParams
 *
 * A camera configuration for a {@link FlatView}.
 *
 * @property {number} x The horizontal coordinate of the image point displayed
 *     at the viewport center, in the [0, 1] range.
 *     When `x === 0.5`, the image is centered horizontally.
 *     When `x === 0`, the left edge of the image is at the viewport center.
 *     When `x === 1`, the right edge of the image is at the viewport center.
 * @property {number} y The vertical coordinate of the image point displayed at
 *     the viewport center, in the [0, 1] range.
 *     When `y === 0.5`, the image is centered vertically.
 *     When `y === 0`, the top edge of the image is at the viewport center.
 *     When `y === 1`, the bottom edge of the image is at the viewport center.
 * @property {number} zoom The horizontal zoom, in the [0, ???) range.
 *     When `zoom === 1`, the viewport is as wide as the image.
 *     When `zoom < 1`, the image is zoomed in.
 *     When `zoom > 1`, the image is zoomed out.
 * @property {number} mediaAspectRatio The image aspect ratio.
 *     When `mediaAspectRatio === 1`, the image width equals its height.
 *     When `mediaAspectRatio < 1`, the image width is less than its height.
 *     When `mediaAspectRatio > 1`, the image height is less than its width.
 */
export interface FlatViewParams {
  x?: number;
  y?: number;
  zoom?: number;
  mediaAspectRatio?: number;
}

/**
 * @interface FlatViewCoords
 *
 * The position of a point in a flat image.
 *
 * @property {number} x The horizontal coordinate, in the [0, 1] range.
 * @property {number} y The vertical coordinate, in the [0, 1] range.
 */
export interface FlatViewCoords {
  x: number;
  y: number;
}

/**
 * @typedef {function} FlatViewLimiter
 *
 * View limiter for a {@link FlatView}.
 *
 * A view limiter is a function that receives a {@link FlatViewParams} object,
 * optionally modifies it in place, and returns it. It can be used to enforce
 * constraints on the view parameters.
 *
 * See {@link FlatView.limit} for commonly used limiters. They may be composed
 * together or with user-defined limiters with {@link util.compose}.
 *
 * @param {FlatViewParams} params
 * @return {FlatViewParams}
 */
export interface FlatViewLimiter {
  (params: FlatViewParams): FlatViewParams;
}

// TODO: check if this should be FlatViewParams
type FlatViewConstructorParams = FlatViewParams & {
  width?: number;
  height?: number;
};

/**
 * @class FlatView
 * @implements View
 * @classdesc
 *
 * A {@link View} implementing an orthogonal projection for flat images.
 *
 * @param {FlatViewParams} params The initial view parameters. The
 *     `mediaAspectRatio` parameter must always be set. The other parameters
 *     default to `{x: 0.5, y: 0.5, z: 1 }` if unspecified.
 * @param {FlatViewLimiter=} limiter The view limiter. If unspecified, no view
 *     limiting is applied. See {@link FlatView.limit} for commonly used
 *     limiters.
 */
class FlatView {
  #x: any;
  #y: any;
  #zoom: any;
  #mediaAspectRatio: any;
  #width: any;
  #height: any;
  #limiter: any;
  #projMatrix: mat4;
  #invProjMatrix: mat4;
  #frustum: number[];
  #projectionChanged: boolean;
  #params: any;
  #vec: vec4;
  static limit: {
    /**
     * Returns a view limiter that constrains the x parameter.
     * @param {number} min The minimum x value.
     * @param {number} max The maximum y value.
     * @return {FlatViewLimiter}
     */
    x: (min: any, max: any) => (params: any) => any;
    /**
     * Return a view limiter that constrains the y parameter.
     * @param {number} min The minimum y value.
     * @param {number} max The maximum y value.
     * @return {FlatViewLimiter}
     */
    y: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter than constrains the zoom parameter.
     * @param {number} min The minimum zoom value.
     * @param {number} max The maximum zoom value.
     * @return {FlatViewLimiter}
     */
    zoom: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that prevents zooming in beyond the given
     * resolution.
     * @param {number} size The image width in pixels.
     * @return {FlatViewLimiter}
     */
    resolution: (size: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the values of the x parameter that
     * are inside the viewport.
     * @param {number} min The minimum x value.
     * @param {number} max The maximum x value.
     * @return {FlatViewLimiter}
     */
    visibleX: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the values of the y parameter that
     * are inside the viewport.
     * @param {number} min The minimum y value.
     * @param {number} max The maximum y value.
     * @return {FlatViewLimiter}
     */
    visibleY: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the zoom parameter such that
     * zooming out is prevented beyond the point at which the image is fully
     * visible. Unless the image and the viewport have the same aspect ratio,
     * this will cause bands to appear around the image.
     * @return {FlatViewLimiter}
     */
    letterbox: () => (params: any) => any;
  };
  static type: string;
  constructor(params: FlatViewConstructorParams, limiter: FlatViewLimiter) {
    // Require an aspect ratio to be specified.
    if (!(params && params.mediaAspectRatio != null)) {
      throw new Error('mediaAspectRatio must be defined');
    }

    // The initial values for the view parameters.
    this.#x = params && params.x != null ? params.x : defaultX;
    this.#y = params && params.y != null ? params.y : defaultY;
    this.#zoom = params && params.zoom != null ? params.zoom : defaultZoom;
    this.#mediaAspectRatio = params.mediaAspectRatio;
    this.#width = params && params.width != null ? params.width : defaultWidth;
    this.#height =
      params && params.height != null ? params.height : defaultHeight;

    // The initial value for the view limiter.
    this.#limiter = limiter || null;

    // The last calculated projection matrix and its inverse.
    this.#projMatrix = mat4.create();
    this.#invProjMatrix = mat4.create();

    // The last calculated view frustum.
    this.#frustum = [
      0,
      0,
      0,
      0, // left
    ];

    // Whether the projection matrices and view frustum need to be updated.
    this.#projectionChanged = true;

    // Temporary variables used for calculations.
    this.#params = {};
    this.#vec = vec4.create();

    // Force view limiting on initial parameters.
    this.#update();
  }
  /**
   * Destructor.
   */
  destroy() {
    clearOwnProperties(this);
  }
  /**
   * Get the x parameter.
   * @return {number}
   */
  x() {
    return this.#x;
  }
  /**
   * Get the y parameter.
   * @return {number}
   */
  y() {
    return this.#y;
  }
  /**
   * Get the zoom value.
   * @return {number}
   */
  zoom() {
    return this.#zoom;
  }
  /**
   * Get the media aspect ratio.
   * @return {number}
   */
  mediaAspectRatio() {
    return this.#mediaAspectRatio;
  }
  /**
   * Get the viewport width.
   * @return {number}
   */
  width() {
    return this.#width;
  }
  /**
   * Get the viewport height.
   * @return {number}
   */
  height() {
    return this.#height;
  }
  /**
   * Get the viewport dimensions. If an argument is supplied, it is filled in with
   * the result and returned. Otherwise, a fresh object is filled in and returned.
   * @param {Size=} size
   * @return {Size}
   */
  size(size) {
    size = size || {};
    size.width = this.#width;
    size.height = this.#height;
    return size;
  }
  /**
   * Get the view parameters. If an argument is supplied, it is filled in with the
   * result and returned. Otherwise, a fresh object is filled in and returned.
   * @param {FlatViewParams=} params
   * @return {FlatViewParams}
   */
  parameters(params?: FlatViewParams) {
    params = params || {};
    params.x = this.#x;
    params.y = this.#y;
    params.zoom = this.#zoom;
    params.mediaAspectRatio = this.#mediaAspectRatio;
    return params;
  }
  /**
   * Get the view limiter, or null if unset.
   * @return {?FlatViewLimiter}
   */
  limiter() {
    return this.#limiter;
  }
  /**
   * Set the x parameter.
   * @param {number} x
   */
  setX(x) {
    this.#resetParams();
    this.#params.x = x;
    this.#update(this.#params);
  }
  /**
   * Set the y parameter.
   * @param {number} y
   */
  setY(y) {
    this.#resetParams();
    this.#params.y = y;
    this.#update(this.#params);
  }
  /**
   * Set the zoom value.
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.#resetParams();
    this.#params.zoom = zoom;
    this.#update(this.#params);
  }
  /**
   * Add xOffset to the x parameter.
   * @param {number} xOffset
   */
  offsetX(xOffset) {
    this.setX(this.#x + xOffset);
  }
  /**
   * Add yOffset to the y parameter.
   * @param {number} yOffset
   */
  offsetY(yOffset) {
    this.setY(this.#y + yOffset);
  }
  /**
   * Add zoomOffset to the zoom value.
   * @param {number} zoomOffset
   */
  offsetZoom(zoomOffset) {
    this.setZoom(this.#zoom + zoomOffset);
  }
  /**
   * Set the media aspect ratio.
   * @param {number} mediaAspectRatio
   */
  setMediaAspectRatio(mediaAspectRatio) {
    this.#resetParams();
    this.#params.mediaAspectRatio = mediaAspectRatio;
    this.#update(this.#params);
  }
  /**
   * Set the viewport dimensions.
   * @param {Size} size
   */
  setSize(size) {
    this.#resetParams();
    this.#params.width = size.width;
    this.#params.height = size.height;
    this.#update(this.#params);
  }
  /**
   * Set the view parameters. Unspecified parameters are left unchanged.
   * @param {FlatViewParameters} params
   */
  setParameters(params) {
    this.#resetParams();
    this.#params.x = params.x;
    this.#params.y = params.y;
    this.#params.zoom = params.zoom;
    this.#params.mediaAspectRatio = params.mediaAspectRatio;
    this.#update(this.#params);
  }
  /**
   * Set the view limiter.
   * @param {?FlatViewLimiter} limiter The new limiter, or null to unset.
   */
  setLimiter(limiter) {
    this.#limiter = limiter || null;
    this.#update();
  }
  #resetParams() {
    const params = this.#params;
    params.x = null;
    params.y = null;
    params.zoom = null;
    params.mediaAspectRatio = null;
    params.width = null;
    params.height = null;
  }
  #update(params?: FlatViewConstructorParams | null) {
    // Avoid object allocation when no parameters are supplied.
    if (params == null) {
      this.#resetParams();
      params = this.#params as FlatViewConstructorParams;
    }

    // Save old parameters for later comparison.
    const oldX = this.#x;
    const oldY = this.#y;
    const oldZoom = this.#zoom;
    const oldMediaAspectRatio = this.#mediaAspectRatio;
    const oldWidth = this.#width;
    const oldHeight = this.#height;

    // Fill in object with the new set of parameters to pass into the limiter.
    params.x = params.x != null ? params.x : oldX;
    params.y = params.y != null ? params.y : oldY;
    params.zoom = params.zoom != null ? params.zoom : oldZoom;
    params.mediaAspectRatio =
      params.mediaAspectRatio != null
        ? params.mediaAspectRatio
        : oldMediaAspectRatio;
    params.width = params.width != null ? params.width : oldWidth;
    params.height = params.height != null ? params.height : oldHeight;

    // Apply view limiting when defined.
    if (this.#limiter) {
      params = this.#limiter(params);
      if (!params) {
        throw new Error('Bad view limiter');
      }
    }

    // Grab the limited parameters.
    const newX = params.x;
    const newY = params.y;
    let newZoom = params.zoom;
    const newMediaAspectRatio = params.mediaAspectRatio;
    const newWidth = params.width;
    const newHeight = params.height;

    // Consistency check.
    if (
      !real(newX) ||
      !real(newY) ||
      !real(newZoom) ||
      !real(newMediaAspectRatio) ||
      !real(newWidth) ||
      !real(newHeight)
    ) {
      throw new Error('Bad view - suspect a broken limiter');
    }

    // Constrain zoom.
    newZoom = clamp(Number(newZoom), zoomLimitEpsilon, Infinity);

    // Update parameters.
    this.#x = newX;
    this.#y = newY;
    this.#zoom = newZoom;
    this.#mediaAspectRatio = newMediaAspectRatio;
    this.#width = newWidth;
    this.#height = newHeight;

    // Check whether the parameters changed and emit the corresponding events.
    if (
      newX !== oldX ||
      newY !== oldY ||
      newZoom !== oldZoom ||
      newMediaAspectRatio !== oldMediaAspectRatio ||
      newWidth !== oldWidth ||
      newHeight !== oldHeight
    ) {
      this.#projectionChanged = true;
      this.emit('change');
    }
    if (newWidth !== oldWidth || newHeight !== oldHeight) {
      this.emit('resize');
    }
  }
  emit(_arg0: string) {
    throw new Error('Method not implemented.');
  }
  #zoomX() {
    return this.#zoom;
  }
  #zoomY() {
    const mediaAspectRatio = this.#mediaAspectRatio;
    const aspect = this.#width / this.#height;
    const zoomX = this.#zoom;
    let zoomY = (zoomX * mediaAspectRatio) / aspect;
    if (isNaN(zoomY)) {
      zoomY = zoomX;
    }
    return zoomY;
  }
  updateWithControlParameters(parameters) {
    const scale = this.zoom();
    const zoomX = this.#zoomX();
    const zoomY = this.#zoomY();

    // TODO: should the scale be the same for both axes?
    this.offsetX(parameters.axisScaledX * zoomX + parameters.x * scale);
    this.offsetY(parameters.axisScaledY * zoomY + parameters.y * scale);
    this.offsetZoom(parameters.zoom * scale);
  }
  #updateProjection() {
    const projMatrix = this.#projMatrix;
    const invProjMatrix = this.#invProjMatrix;
    const frustum = this.#frustum;

    // Recalculate projection matrix when required.
    if (this.#projectionChanged) {
      const x = this.#x;
      const y = this.#y;
      const zoomX = this.#zoomX();
      const zoomY = this.#zoomY();

      // Recalculate view frustum.
      const top = (frustum[0] = 0.5 - y + 0.5 * zoomY);
      const right = (frustum[1] = x - 0.5 + 0.5 * zoomX);
      const bottom = (frustum[2] = 0.5 - y - 0.5 * zoomY);
      const left = (frustum[3] = x - 0.5 - 0.5 * zoomX);

      // Recalculate projection matrix and its inverse.
      mat4.ortho(projMatrix, left, right, bottom, top, -1, 1);
      mat4.invert(invProjMatrix, projMatrix);

      this.#projectionChanged = false;
    }
  }
  /**
   * Returns the projection matrix for the current view.
   * @returns {mat4}
   */
  projection() {
    this.#updateProjection();
    return this.#projMatrix;
  }
  /**
   * Returns the inverse projection matrix for the current view.
   * @returns {mat4}
   */
  inverseProjection() {
    this.#updateProjection();
    return this.#invProjMatrix;
  }
  /**
   * Return whether the view frustum intersects the given rectangle.
   *
   * This function may return false positives, but never false negatives.
   * It is used for frustum culling, i.e., excluding invisible tiles from the
   * rendering process.
   *
   * @param {vec3[]} rectangle The vertices of the rectangle.
   */
  intersects(rectangle) {
    this.#updateProjection();

    const frustum = this.#frustum;

    // Check whether the rectangle is on the outer side of any of the frustum
    // planes. This is a sufficient condition, though not necessary, for the
    // rectangle to be completely outside the fruouter
    for (let i = 0; i < frustum.length; i++) {
      const limit = frustum[i];
      const axis = planeAxes[i];
      const cmp = planeCmp[i];
      let inside = false;
      for (let j = 0; j < rectangle.length; j++) {
        const vertex = rectangle[j];
        if (
          (cmp < 0 && vertex[axis] < limit) ||
          (cmp > 0 && vertex[axis] > limit)
        ) {
          inside = true;
          break;
        }
      }
      if (!inside) {
        return false;
      }
    }
    return true;
  }
  /**
   * Select the level that should be used to render the view.
   * @param {Level[]} levelList the list of levels from which to select.
   * @return {Level} the selected level.
   */
  selectLevel(levels) {
    // Multiply the viewport width by the device pixel ratio to get the required
    // horizontal resolution in pixels.
    //
    // Calculate the fraction of the image that would be visible at the current
    // zoom value. Then, for each level, multiply by the level width to get the
    // width in pixels of the portion that would be visible.
    //
    // Search for the smallest level that satifies the the required width,
    // falling back on the largest level if none do.

    const requiredPixels = pixelRatio() * this.width();
    const zoomFactor = this.#zoom;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (zoomFactor * level.width() >= requiredPixels) {
        return level;
      }
    }

    return levels[levels.length - 1];
  }
  /**
   * Convert view coordinates into screen coordinates. If a result argument is
   * provided, it is filled in and returned. Otherwise, a fresh object is filled
   * in and returned.
   *
   * @param {FlatViewCoords} coords The view coordinates.
   * @param {Coords=} result The result argument for the screen coordinates.
   * @return {Coords}
   */
  coordinatesToScreen(coords, result) {
    const ray = this.#vec;

    if (!result) {
      result = {};
    }

    const width = this.#width;
    const height = this.#height;

    // Undefined on a null viewport.
    if (width <= 0 || height <= 0) {
      result.x = null;
      result.y = null;
      return null;
    }

    // Extract coordinates from argument, filling in default values.
    const x = coords && coords.x != null ? coords.x : defaultX;
    const y = coords && coords.y != null ? coords.y : defaultY;

    // Project view ray onto clip space.
    vec4.set(ray, x - 0.5, 0.5 - y, -1, 1);
    vec4.transformMat4(ray, ray, this.projection());

    // Calculate perspective divide.
    for (let i = 0; i < 3; i++) {
      ray[i] /= ray[3];
    }

    // Convert to viewport coordinates and return.
    result.x = (width * (ray[0] + 1)) / 2;
    result.y = (height * (1 - ray[1])) / 2;

    return result;
  }
  /**
   * Convert screen coordinates into view coordinates. If a result argument is
   * provided, it is filled in with the result and returned. Otherwise, a fresh
   * object is filled in and returned.
   *
   * @param {Coords} coords The screen coordinates.
   * @param {FlatViewCoords=} result The result argument for the view coordinates.
   * @return {FlatViewCoords}
   */
  screenToCoordinates(coords, result) {
    const ray = this.#vec;

    if (!result) {
      result = {};
    }

    const width = this.#width;
    const height = this.#height;

    // Convert viewport coordinates to clip space.
    const vecx = (2 * coords.x) / width - 1;
    const vecy = 1 - (2 * coords.y) / height;
    vec4.set(ray, vecx, vecy, 1, 1);

    // Project back to world space.
    vec4.transformMat4(ray, ray, this.inverseProjection());

    // Convert to flat coordinates.
    result.x = 0.5 + ray[0];
    result.y = 0.5 - ray[1];

    return result;
  }
}

eventEmitter(FlatView);

/**
 * Factory functions for view limiters. See {@link FlatViewLimiter}.
 * @namespace
 */
FlatView.limit = {
  /**
   * Returns a view limiter that constrains the x parameter.
   * @param {number} min The minimum x value.
   * @param {number} max The maximum y value.
   * @return {FlatViewLimiter}
   */
  x: function (min, max) {
    return function limitX(params) {
      params.x = clamp(params.x, min, max);
      return params;
    };
  },

  /**
   * Return a view limiter that constrains the y parameter.
   * @param {number} min The minimum y value.
   * @param {number} max The maximum y value.
   * @return {FlatViewLimiter}
   */
  y: function (min, max) {
    return function limitY(params) {
      params.y = clamp(params.y, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter than constrains the zoom parameter.
   * @param {number} min The minimum zoom value.
   * @param {number} max The maximum zoom value.
   * @return {FlatViewLimiter}
   */
  zoom: function (min, max) {
    return function limitZoom(params) {
      params.zoom = clamp(params.zoom, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that prevents zooming in beyond the given
   * resolution.
   * @param {number} size The image width in pixels.
   * @return {FlatViewLimiter}
   */
  resolution: function (size) {
    return function limitResolution(params) {
      if (params.width <= 0 || params.height <= 0) {
        return params;
      }
      const width = params.width;
      const minZoom = (pixelRatio() * width) / size;
      params.zoom = clamp(params.zoom, minZoom, Infinity);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the values of the x parameter that
   * are inside the viewport.
   * @param {number} min The minimum x value.
   * @param {number} max The maximum x value.
   * @return {FlatViewLimiter}
   */
  visibleX: function (min, max) {
    return function limitVisibleX(params) {
      // Calculate the zoom value that makes the specified range fully visible.
      const maxZoom = max - min;

      // Clamp zoom to the maximum value.
      if (params.zoom > maxZoom) {
        params.zoom = maxZoom;
      }

      // Bound X such that the image is visible up to the range edges.
      const minX = min + 0.5 * params.zoom;
      const maxX = max - 0.5 * params.zoom;
      params.x = clamp(params.x, minX, maxX);

      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the values of the y parameter that
   * are inside the viewport.
   * @param {number} min The minimum y value.
   * @param {number} max The maximum y value.
   * @return {FlatViewLimiter}
   */
  visibleY: function (min, max) {
    return function limitVisibleY(params) {
      // Do nothing for a null viewport.
      if (params.width <= 0 || params.height <= 0) {
        return params;
      }

      // Calculate the X to Y conversion factor.
      const viewportAspectRatio = params.width / params.height;
      const factor = viewportAspectRatio / params.mediaAspectRatio;

      // Calculate the zoom value that makes the specified range fully visible.
      const maxZoom = (max - min) * factor;

      // Clamp zoom to the maximum value.
      if (params.zoom > maxZoom) {
        params.zoom = maxZoom;
      }

      // Bound Y such that the image is visible up to the range edges.
      const minY = min + (0.5 * params.zoom) / factor;
      const maxY = max - (0.5 * params.zoom) / factor;
      params.y = clamp(params.y, minY, maxY);

      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the zoom parameter such that
   * zooming out is prevented beyond the point at which the image is fully
   * visible. Unless the image and the viewport have the same aspect ratio,
   * this will cause bands to appear around the image.
   * @return {FlatViewLimiter}
   */
  letterbox: function () {
    return function limitLetterbox(params) {
      if (params.width <= 0 || params.height <= 0) {
        return params;
      }
      const viewportAspectRatio = params.width / params.height;

      const fullWidthZoom = 1.0;
      const fullHeightZoom = viewportAspectRatio / params.mediaAspectRatio;

      // If the image is wider than the viewport, limit the horizontal zoom to
      // the image width.
      if (params.mediaAspectRatio >= viewportAspectRatio) {
        params.zoom = Math.min(params.zoom, fullWidthZoom);
      }

      // If the image is narrower than the viewport, limit the vertical zoom to
      // the image height.
      if (params.mediaAspectRatio <= viewportAspectRatio) {
        params.zoom = Math.min(params.zoom, fullHeightZoom);
      }

      // If the full image width is visible, limit x to the central point.
      // Else, bound x such that image is visible up to the horizontal edges.
      let minX, maxX;
      if (params.zoom > fullWidthZoom) {
        minX = maxX = 0.5;
      } else {
        minX = 0.0 + (0.5 * params.zoom) / fullWidthZoom;
        maxX = 1.0 - (0.5 * params.zoom) / fullWidthZoom;
      }

      // If the full image height is visible, limit y to the central point.
      // Else, bound y such that image is visible up to the vertical edges.
      let minY, maxY;
      if (params.zoom > fullHeightZoom) {
        minY = maxY = 0.5;
      } else {
        minY = 0.0 + (0.5 * params.zoom) / fullHeightZoom;
        maxY = 1.0 - (0.5 * params.zoom) / fullHeightZoom;
      }

      // Clamp x and y into the calculated bounds.
      params.x = clamp(params.x, minX, maxX);
      params.y = clamp(params.y, minY, maxY);

      return params;
    };
  },
};

// TODO: figure out how to fix this `type` thing
// @ts-ignore
FlatView.type = FlatView.prototype.type = 'flat';

export default FlatView;
