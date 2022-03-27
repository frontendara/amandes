import eventEmitter from "minimal-event-emitter";
import { mat4 as mat4 } from "gl-matrix";
import { vec4 as vec4 } from "gl-matrix";
import pixelRatio from "../util/pixelRatio";
import convertFov from "../util/convertFov";
import mod from "../util/mod";
import real from "../util/real";
import clamp from "../util/clamp";
import decimal from "../util/decimal";
import compose from "../util/compose";
import clearOwnProperties from "../util/clearOwnProperties";
import { Coords } from "../jsdoc-extras";
import Level from "../geometries/Level";

// Default viewport dimensions.
// Start with zero to ensure that those values are handled correctly.
var defaultWidth = 0;
var defaultHeight = 0;

// Default view parameters.
var defaultYaw = 0;
var defaultPitch = 0;
var defaultRoll = 0;
var defaultFov = Math.PI / 4;
var defaultProjectionCenterX = 0;
var defaultProjectionCenterY = 0;

// A fov of exactly 0 or π breaks some computations, so we constrain it to the
// [fovLimitEpsilon, π - fovLimitEpsilon] interval. We use 6 decimal places for
// the epsilon value to avoid broken rendering due to loss of precision in
// floating point computations.
var fovLimitEpsilon = 0.000001;

/**
 * @interface RectilinearViewParams
 *
 * A camera configuration for a {@link RectilinearView}.
 *
 * @property {number} yaw The yaw angle, in the [-π, π] range.
 *     When `yaw < 0`, the view rotates to the left.
 *     When `yaw > 0`, the view rotates to the right.
 *
 * @property {number} pitch The pitch angle, in the [-π, π] range.
 *     When `pitch < 0`, the view rotates downwards.
 *     When `pitch > 0`, the view rotates upwards.
 *
 * @property {number} roll The roll angle, in the [-π, π] range.
 *     When `roll < 0`, the view rotates clockwise.
 *     When `roll > 0`, the view rotates counter-clockwise.
 *
 * @property {fov} fov The vertical field of view, in the [0, π] range.
 */
export interface RectilinearViewParams {
  yaw?: number;
  pitch?: number;
  roll?: number;
  fov?: number;
  projectionCenterX?: number;
  projectionCenterY?: number;
}

/**
 * @interface RectilinearViewCoords
 *
 * The position of a point in a 360° image.
 *
 * @property {number} yaw The yaw angle, in the [-π, π] range.
 * @property {number} pitch The pitch angle, in the [-π, π] range.
 */
export interface RectilinearViewCoords {
  yaw: number;
  pitch: number;
}

/**
 * @typedef {function} RectilinearViewLimiter
 *
 * View limiter for a {@link RectilinearView}.
 *
 * A view limiter is a function that receives a {@link RectilinearViewParams}
 * object, optionally modifies it in place, and returns it. It can be used to
 * enforce constraints on the view parameters.
 *
 * See {@link RectilinearView.limit} for commonly used limiters. They may be
 * composed together or with user-defined limiters with {@link util.compose}.
 *
 * @param {RectilinearViewParams} params
 * @return {RectilinearViewParams}
 */

/**
 * @class RectilinearView
 * @implements View
 * @classdesc
 *
 * A {@link View} implementing a rectilinear projection for 360° images.
 *
 * @param {RectilinearViewParams=} params The initial view parameters. If
 *     unspecified, defaults to `{yaw: 0, pitch: 0, roll: 0, fov: Math.PI/4 }`.
 * @param {RectilinearViewLimiter=} limiter The view limiter. If unspecified,
 *     no view limiting is applied. See {@link RectilinearView.limit} for
 *     commonly used limiters.
 */
class RectilinearView {
  #yaw: any;
  #pitch: any;
  #roll: any;
  #fov: any;
  #width: any;
  #height: any;
  #projectionCenterX: any;
  #projectionCenterY: any;
  #limiter: any;
  #projMatrix: mat4;
  #invProjMatrix: mat4;
  #frustum: vec4[];
  #projectionChanged: boolean;
  #params: any;
  #fovs: any;
  #tmpVec: vec4;
  static limit: {
    /**
     * Returns a view limiter that constrains the yaw angle.
     * @param {number} min The minimum yaw value.
     * @param {number} max The maximum yaw value.
     * @return {RectilinearViewLimiter}
     */
    yaw: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the pitch angle.
     * @param {number} min The minimum pitch value.
     * @param {number} max The maximum pitch value.
     * @return {RectilinearViewLimiter}
     */
    pitch: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the roll angle.
     * @param {number} min The minimum roll value.
     * @param {number} max The maximum roll value.
     * @return {RectilinearViewLimiter}
     */
    roll: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the horizontal field of view.
     * @param {number} min The minimum horizontal field of view.
     * @param {number} max The maximum horizontal field of view.
     * @return {RectilinearViewLimiter}
     */
    hfov: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that constrains the vertical field of view.
     * @param {number} min The minimum vertical field of view.
     * @param {number} max The maximum vertical field of view.
     * @return {RectilinearViewLimiter}
     */
    vfov: (min: any, max: any) => (params: any) => any;
    /**
     * Returns a view limiter that prevents zooming in beyond the given
     * resolution.
     * @param {number} size The cube face width in pixels or, equivalently, one
     *     fourth of the equirectangular width in pixels.
     * @return {RectilinearViewLimiter}
     */
    resolution: (size: any) => (params: any) => any;
    /**
     * Returns a view limiter that limits the horizontal and vertical field of
     * view, prevents zooming in past the image resolution, and limits the pitch
     * range to prevent the camera wrapping around at the poles. These are the
     * most common view constraints for a 360° panorama.
     * @param {number} maxResolution The cube face width in pixels or,
     *     equivalently, one fourth of the equirectangular width in pixels.
     * @param {number} maxVFov The maximum vertical field of view.
     * @param {number} [maxHFov=maxVFov] The maximum horizontal field of view.
     * @return {RectilinearViewLimiter}
     */
    traditional: (maxResolution: any, maxVFov: any, maxHFov?: any) => Function;
  };
  static type: string;
  constructor(
    params: RectilinearViewParams & {
      width?: number;
      height?: number;
      projectionCenterX?: number;
      projectionCenterY?: number;
    },
    limiter: Function | null
  ) {
    // The initial values for the view parameters.
    this.#yaw = params && params.yaw != null ? params.yaw : defaultYaw;
    this.#pitch = params && params.pitch != null ? params.pitch : defaultPitch;
    this.#roll = params && params.roll != null ? params.roll : defaultRoll;
    this.#fov = params && params.fov != null ? params.fov : defaultFov;
    this.#width = params && params.width != null ? params.width : defaultWidth;
    this.#height =
      params && params.height != null ? params.height : defaultHeight;
    this.#projectionCenterX =
      params && params.projectionCenterX != null
        ? params.projectionCenterX
        : defaultProjectionCenterX;
    this.#projectionCenterY =
      params && params.projectionCenterY != null
        ? params.projectionCenterY
        : defaultProjectionCenterY;

    // The initial value for the view limiter.
    this.#limiter = limiter || null;

    // The last calculated projection matrix and its inverse.
    this.#projMatrix = mat4.create();
    this.#invProjMatrix = mat4.create();

    // The last calculated view frustum.
    this.#frustum = [
      vec4.create(),
      vec4.create(),
      vec4.create(),
      vec4.create(),
      vec4.create(), // camera
    ];

    // Whether the projection matrices and the view frustum need to be updated.
    this.#projectionChanged = true;

    // Temporary variables used for calculations.
    this.#params = {};
    this.#fovs = {};
    this.#tmpVec = vec4.create();

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
   * Get the yaw angle.
   * @return {number}
   */
  yaw() {
    return this.#yaw;
  }
  /**
   * Get the pitch angle.
   * @return {number}
   */
  pitch() {
    return this.#pitch;
  }
  /**
   * Get the roll angle.
   * @return {number}
   */
  roll() {
    return this.#roll;
  }
  projectionCenterX() {
    return this.#projectionCenterX;
  }
  projectionCenterY() {
    return this.#projectionCenterY;
  }
  /**
   * Get the fov value.
   * @return {number}
   */
  fov() {
    return this.#fov;
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
  size(size: { width?: any; height?: any }) {
    size = size || {};
    size.width = this.#width;
    size.height = this.#height;
    return size;
  }
  /**
   * Get the view parameters. If an argument is supplied, it is filled in with the
   * result and returned. Otherwise, a fresh object is filled in and returned.
   * @param {RectilinearViewParams=} obj
   * @return {RectilinearViewParams}
   */
  parameters(params?: RectilinearViewParams) {
    params = params || {};
    params.yaw = this.#yaw;
    params.pitch = this.#pitch;
    params.roll = this.#roll;
    params.fov = this.#fov;
    return params;
  }
  /**
   * Get the view limiter, or null if unset.
   * @return {?RectilinearViewLimiter}
   */
  limiter() {
    return this.#limiter;
  }
  /**
   * Set the yaw angle.
   * @param {number} yaw
   */
  setYaw(yaw: any) {
    this.#resetParams();
    this.#params.yaw = yaw;
    this.#update(this.#params);
  }
  /**
   * Set the pitch angle.
   * @param {number} pitch
   */
  setPitch(pitch: any) {
    this.#resetParams();
    this.#params.pitch = pitch;
    this.#update(this.#params);
  }
  /**
   * Set the roll angle.
   * @param {number} roll
   */
  setRoll(roll: any) {
    this.#resetParams();
    this.#params.roll = roll;
    this.#update(this.#params);
  }
  /**
   * Set the fov value.
   * @param {number} fov
   */
  setFov(fov: any) {
    this.#resetParams();
    this.#params.fov = fov;
    this.#update(this.#params);
  }
  setProjectionCenterX(projectionCenterX: any) {
    this.#resetParams();
    this.#params.projectionCenterX = projectionCenterX;
    this.#update(this.#params);
  }
  setProjectionCenterY(projectionCenterY: any) {
    this.#resetParams();
    this.#params.projectionCenterY = projectionCenterY;
    this.#update(this.#params);
  }
  /**
   * Add yawOffset to the current yaw value.
   * @param {number} yawOffset
   */
  offsetYaw(yawOffset: any) {
    this.setYaw(this.#yaw + yawOffset);
  }
  /**
   * Add pitchOffset to the current pitch value.
   * @param {number} pitchOffset
   */
  offsetPitch(pitchOffset: any) {
    this.setPitch(this.#pitch + pitchOffset);
  }
  /**
   * Add rollOffset to the current roll value.
   * @param {number} rollOffset
   */
  offsetRoll(rollOffset: number) {
    this.setRoll(this.#roll + rollOffset);
  }
  /**
   * Add fovOffset to the current fov value.
   * @param {number} fovOffset
   */
  offsetFov(fovOffset: number) {
    this.setFov(this.#fov + fovOffset);
  }
  /**
   * Set the viewport dimensions.
   * @param {Size} size
   */
  setSize(size: { width: any; height: any }) {
    this.#resetParams();
    this.#params.width = size.width;
    this.#params.height = size.height;
    this.#update(this.#params);
  }
  /**
   * Set the view parameters. Unspecified parameters are left unchanged.
   * @param params
   */
  setParameters(params: RectilinearViewParams) {
    this.#resetParams();
    this.#params.yaw = params.yaw;
    this.#params.pitch = params.pitch;
    this.#params.roll = params.roll;
    this.#params.fov = params.fov;
    this.#params.projectionCenterX = params.projectionCenterX;
    this.#params.projectionCenterY = params.projectionCenterY;
    this.#update(this.#params);
  }
  /**
   * Set the view limiter.
   * @param {?RectilinearViewLimiter} limiter The new limiter, or null to unset.
   */
  setLimiter(limiter: null) {
    this.#limiter = limiter || null;
    this.#update();
  }
  #resetParams() {
    var params = this.#params;
    params.yaw = null;
    params.pitch = null;
    params.roll = null;
    params.fov = null;
    params.width = null;
    params.height = null;
  }
  #update(
    params?: {
      yaw?: any;
      pitch?: any;
      roll?: any;
      fov?: any;
      width?: any;
      height?: any;
      projectionCenterX?: any;
      projectionCenterY?: any;
    } | null
  ) {
    // Avoid object allocation when no parameters are supplied.
    if (params == null) {
      this.#resetParams();
      // TODO: better type when params type is fixed
      params = this.#params as Object;
    }

    // Save old parameters for later comparison.
    var oldYaw = this.#yaw;
    var oldPitch = this.#pitch;
    var oldRoll = this.#roll;
    var oldFov = this.#fov;
    var oldProjectionCenterX = this.#projectionCenterX;
    var oldProjectionCenterY = this.#projectionCenterY;
    var oldWidth = this.#width;
    var oldHeight = this.#height;

    // Fill in object with the new set of parameters to pass into the limiter.
    params.yaw = params.yaw != null ? params.yaw : oldYaw;
    params.pitch = params.pitch != null ? params.pitch : oldPitch;
    params.roll = params.roll != null ? params.roll : oldRoll;
    params.fov = params.fov != null ? params.fov : oldFov;
    params.width = params.width != null ? params.width : oldWidth;
    params.height = params.height != null ? params.height : oldHeight;
    params.projectionCenterX =
      params.projectionCenterX != null
        ? params.projectionCenterX
        : oldProjectionCenterX;
    params.projectionCenterY =
      params.projectionCenterY != null
        ? params.projectionCenterY
        : oldProjectionCenterY;

    // Apply view limiting when defined.
    if (this.#limiter) {
      params = this.#limiter(params);
      if (!params) {
        throw new Error("Bad view limiter");
      }
    }

    // TODO: fix up the types
    // Normalize parameters.
    params = this.#normalize(params as any);

    // Grab the limited parameters.
    var newYaw = params.yaw;
    var newPitch = params.pitch;
    var newRoll = params.roll;
    var newFov = params.fov;
    var newWidth = params.width;
    var newHeight = params.height;
    var newProjectionCenterX = params.projectionCenterX;
    var newProjectionCenterY = params.projectionCenterY;

    // Consistency check.
    if (
      !real(newYaw) ||
      !real(newPitch) ||
      !real(newRoll) ||
      !real(newFov) ||
      !real(newWidth) ||
      !real(newHeight) ||
      !real(newProjectionCenterX) ||
      !real(newProjectionCenterY)
    ) {
      throw new Error("Bad view - suspect a broken limiter");
    }

    // Update parameters.
    this.#yaw = newYaw;
    this.#pitch = newPitch;
    this.#roll = newRoll;
    this.#fov = newFov;
    this.#width = newWidth;
    this.#height = newHeight;
    this.#projectionCenterX = newProjectionCenterX;
    this.#projectionCenterY = newProjectionCenterY;

    // Check whether the parameters changed and emit the corresponding events.
    if (
      newYaw !== oldYaw ||
      newPitch !== oldPitch ||
      newRoll !== oldRoll ||
      newFov !== oldFov ||
      newWidth !== oldWidth ||
      newHeight !== oldHeight ||
      newProjectionCenterX !== oldProjectionCenterX ||
      newProjectionCenterY !== oldProjectionCenterY
    ) {
      this.#projectionChanged = true;
      this.emit("change");
    }
    if (newWidth !== oldWidth || newHeight !== oldHeight) {
      this.emit("resize");
    }
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
  #normalize(params: {
    yaw?: any;
    pitch?: any;
    roll?: any;
    fov: any;
    width: any;
    height: any;
    projectionCenterX?: any;
    projectionCenterY?: any;
  }) {
    this.#normalizeCoordinates(params);

    // Make sure that neither the horizontal nor the vertical fields of view
    // exceed π - fovLimitEpsilon.
    var hfovPi = convertFov.htov(Math.PI, params.width, params.height);
    var maxFov = isNaN(hfovPi) ? Math.PI : Math.min(Math.PI, hfovPi);
    params.fov = clamp(params.fov, fovLimitEpsilon, maxFov - fovLimitEpsilon);

    return params;
  }
  #normalizeCoordinates(params) {
    // Constrain yaw, pitch and roll to the [-π, π] interval.
    if ("yaw" in params) {
      params.yaw = mod(params.yaw - Math.PI, -2 * Math.PI) + Math.PI;
    }
    if ("pitch" in params) {
      params.pitch = mod(params.pitch - Math.PI, -2 * Math.PI) + Math.PI;
    }
    if ("roll" in params) {
      params.roll = mod(params.roll - Math.PI, -2 * Math.PI) + Math.PI;
    }
    return params;
  }
  /**
   * Normalize view coordinates so that they are the closest to the current view.
   * Useful for tweening the view through the shortest path. If a result argument
   * is supplied, it is filled in with the result and returned. Otherwise, a fresh
   * object is filled in and returned.
   *
   * @param {RectilinearViewCoords} coords The view coordinates.
   * @param {RectilinearViewCoords} result The result argument for the normalized
   *     view coordinates.
   */
  normalizeToClosest(
    coords: RectilinearViewCoords,
    result: RectilinearViewCoords
  ) {
    var viewYaw = this.#yaw;
    var viewPitch = this.#pitch;

    var coordYaw = coords.yaw;
    var coordPitch = coords.pitch;

    // Check if the yaw is closer after subtracting or adding a full circle.
    var prevYaw = coordYaw - 2 * Math.PI;
    var nextYaw = coordYaw + 2 * Math.PI;
    if (Math.abs(prevYaw - viewYaw) < Math.abs(coordYaw - viewYaw)) {
      coordYaw = prevYaw;
    } else if (Math.abs(nextYaw - viewYaw) < Math.abs(coordYaw - viewYaw)) {
      coordYaw = nextYaw;
    }

    // Check if the pitch is closer after subtracting or adding a full circle.
    var prevPitch = coordPitch - 2 * Math.PI;
    var nextPitch = coordPitch + 2 * Math.PI;
    if (Math.abs(prevPitch - viewPitch) < Math.abs(coordPitch - viewPitch)) {
      coordPitch = prevPitch;
    } else if (
      Math.abs(prevPitch - viewPitch) < Math.abs(coordPitch - viewPitch)
    ) {
      coordPitch = nextPitch;
    }

    result = result || {};
    result.yaw = coordYaw;
    result.pitch = coordPitch;
    return result;
  }
  updateWithControlParameters(parameters) {
    // axisScaledX and axisScaledY are scaled according to their own axis
    // x and y are scaled by the same value
    // If the viewport dimensions are zero, assume a square viewport
    // when converting from hfov to vfov.
    var vfov = this.#fov;
    var hfov = convertFov.vtoh(vfov, this.#width, this.#height);
    if (isNaN(hfov)) {
      hfov = vfov;
    }

    // TODO: revisit this after we rethink the control parameters.
    this.offsetYaw(
      parameters.axisScaledX * hfov + parameters.x * 2 * hfov + parameters.yaw
    );
    this.offsetPitch(
      parameters.axisScaledY * vfov + parameters.y * 2 * hfov + parameters.pitch
    );
    this.offsetRoll(-parameters.roll);
    this.offsetFov(parameters.zoom * vfov);
  }
  #updateProjection() {
    var projMatrix = this.#projMatrix;
    var invProjMatrix = this.#invProjMatrix;
    var frustum = this.#frustum;

    if (this.#projectionChanged) {
      var width = this.#width;
      var height = this.#height;

      var vfov = this.#fov;
      var hfov = convertFov.vtoh(vfov, width, height);
      var aspect = width / height;

      var projectionCenterX = this.#projectionCenterX;
      var projectionCenterY = this.#projectionCenterY;

      if (projectionCenterX !== 0 || projectionCenterY !== 0) {
        var offsetAngleX = Math.atan(
          projectionCenterX * 2 * Math.tan(hfov / 2)
        );
        var offsetAngleY = Math.atan(
          projectionCenterY * 2 * Math.tan(vfov / 2)
        );
        var fovs = this.#fovs;
        fovs.leftDegrees = ((hfov / 2 + offsetAngleX) * 180) / Math.PI;
        fovs.rightDegrees = ((hfov / 2 - offsetAngleX) * 180) / Math.PI;
        fovs.upDegrees = ((vfov / 2 + offsetAngleY) * 180) / Math.PI;
        fovs.downDegrees = ((vfov / 2 - offsetAngleY) * 180) / Math.PI;
        mat4.perspectiveFromFieldOfView(projMatrix, fovs, -1, 1);
      } else {
        mat4.perspective(projMatrix, vfov, aspect, -1, 1);
      }

      mat4.rotateZ(projMatrix, projMatrix, this.#roll);
      mat4.rotateX(projMatrix, projMatrix, this.#pitch);
      mat4.rotateY(projMatrix, projMatrix, this.#yaw);

      mat4.invert(invProjMatrix, projMatrix);

      this.#matrixToFrustum(projMatrix, frustum);

      this.#projectionChanged = false;
    }
  }
  #matrixToFrustum(p: any[] | Float32Array, f: vec4[]) {
    // Extract frustum planes from projection matrix.
    // http://www8.cs.umu.se/kurser/5DV051/HT12/lab/plane#extraction.pdf
    vec4.set(f[0], p[3] + p[0], p[7] + p[4], p[11] + p[8], 0); // left
    vec4.set(f[1], p[3] - p[0], p[7] - p[4], p[11] - p[8], 0); // right
    vec4.set(f[2], p[3] + p[1], p[7] + p[5], p[11] + p[9], 0); // top
    vec4.set(f[3], p[3] - p[1], p[7] - p[5], p[11] - p[9], 0); // bottom
    vec4.set(f[4], p[3] + p[2], p[7] + p[6], p[11] + p[10], 0); // camera
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
   * @param {vec2[]} rectangle The vertices of the rectangle.
   */
  intersects(rectangle: string | any[]) {
    this.#updateProjection();

    var frustum = this.#frustum;
    var vertex = this.#tmpVec;

    // Check whether the rectangle is on the outer side of any of the frustum
    // planes. This is a sufficient condition, though not necessary, for the
    // rectangle to be completely outside the frustum.
    for (var i = 0; i < frustum.length; i++) {
      var plane = frustum[i];
      var inside = false;
      for (var j = 0; j < rectangle.length; j++) {
        var corner = rectangle[j];
        vec4.set(vertex, corner[0], corner[1], corner[2], 0);
        if (vec4.dot(plane, vertex) >= 0) {
          inside = true;
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
   * @param levelList the list of levels from which to select.
   * @return the selected level.
   */
  selectLevel(levelList: Level[]) {
    // Multiply the viewport width by the device pixel ratio to get the required
    // horizontal resolution in pixels.
    //
    // Calculate the fraction of a cube face that would be visible given the
    // current vertical field of view. Then, for each level, multiply by the
    // level height to get the height in pixels of the portion that would be
    // visible.
    //
    // Search for the smallest level that satifies the the required height,
    // falling back on the largest level if none do.

    var requiredPixels = pixelRatio() * this.#height;
    var coverFactor = Math.tan(0.5 * this.#fov);

    for (var i = 0; i < levelList.length; i++) {
      var level = levelList[i];
      if (coverFactor * level.height() >= requiredPixels) {
        return level;
      }
    }

    return levelList[levelList.length - 1];
  }
  /**
   * Convert view parameters into screen position. If a result argument is
   * provided, it is filled in and returned. Otherwise, a fresh object is filled
   * in and returned.
   *
   * @param {RectilinearViewCoords} coords The view coordinates.
   * @param {Coords=} result The result argument for the screen coordinates.
   * @return {Coords}
   */
  coordinatesToScreen(coords: RectilinearViewCoords, result: Coords) {
    var ray = this.#tmpVec;

    if (!result) {
      result = {} as any;
    }

    var width = this.#width;
    var height = this.#height;

    // Undefined on a null viewport.
    if (width <= 0 || height <= 0) {
      // @ts-ignore
      result.x = null;
      // @ts-ignore
      result.y = null;
      return null;
    }

    // Compute view ray pointing into the (yaw, pitch) direction.
    var yaw = coords.yaw;
    var pitch = coords.pitch;
    var x = Math.sin(yaw) * Math.cos(pitch);
    var y = -Math.sin(pitch);
    var z = -Math.cos(yaw) * Math.cos(pitch);
    vec4.set(ray, x, y, z, 1);

    // Project view ray onto clip space.
    vec4.transformMat4(ray, ray, this.projection());

    // w in clip space equals -z in camera space.
    if (ray[3] >= 0) {
      // Point is in front of camera.
      // Convert to viewport coordinates.
      result.x = (width * (ray[0] / ray[3] + 1)) / 2;
      result.y = (height * (1 - ray[1] / ray[3])) / 2;
    } else {
      // Point is behind camera.
      // @ts-ignore
      result.x = null;
      // @ts-ignore
      result.y = null;
      return null;
    }

    return result;
  }
  /**
   * Convert screen coordinates into view coordinates. If a result argument is
   * provided, it is filled in with the result and returned. Otherwise, a fresh
   * object is filled in and returned.
   *
   * @param coords The screen coordinates.
   * @param result The view coordinates.
   */
  screenToCoordinates(
    coords: Coords,
    result: RectilinearViewCoords
  ): RectilinearViewCoords {
    var ray = this.#tmpVec;

    if (!result) {
      result = {} as any;
    }

    var width = this.#width;
    var height = this.#height;

    // Convert viewport coordinates to clip space.
    var vecx = (2 * coords.x) / width - 1;
    var vecy = 1 - (2 * coords.y) / height;
    vec4.set(ray, vecx, vecy, 1, 1);

    // Project back to world space.
    vec4.transformMat4(ray, ray, this.inverseProjection());

    // Convert to spherical coordinates.
    var r = Math.sqrt(ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2]);
    result.yaw = Math.atan2(ray[0], -ray[2]);
    result.pitch = Math.acos(ray[1] / r) - Math.PI / 2;

    this.#normalizeCoordinates(result);

    return result;
  }
  /**
   * Calculate the perspective transform required to position an element with
   * perspective.
   *
   * @param {RectilinearViewCoords} coords The view coordinates.
   * @param {number} radius Radius of the sphere embedding the element.
   * @param {string} extraTransforms Extra transformations to be applied after
   *     the element is positioned. This may be used to rotate the element.
   * @return {string} The CSS 3D transform to be applied to the element.
   */
  coordinatesToPerspectiveTransform(
    coords: RectilinearViewCoords,
    radius: number,
    extraTransforms: string
  ) {
    extraTransforms = extraTransforms || "";

    var height = this.#height;
    var width = this.#width;
    var fov = this.#fov;
    var perspective = (0.5 * height) / Math.tan(fov / 2);

    var transform = "";

    // Center hotspot in screen.
    transform += "translateX(" + decimal(width / 2) + "px) ";
    transform += "translateY(" + decimal(height / 2) + "px) ";
    transform += "translateX(-50%) translateY(-50%) ";

    // Set the perspective depth.
    transform += "perspective(" + decimal(perspective) + "px) ";
    transform += "translateZ(" + decimal(perspective) + "px) ";

    // Set the camera rotation.
    transform += "rotateZ(" + decimal(-this.#roll) + "rad) ";
    transform += "rotateX(" + decimal(-this.#pitch) + "rad) ";
    transform += "rotateY(" + decimal(this.#yaw) + "rad) ";

    // Set the hotspot rotation.
    transform += "rotateY(" + decimal(-coords.yaw) + "rad) ";
    transform += "rotateX(" + decimal(coords.pitch) + "rad) ";

    // Move back to sphere.
    transform += "translateZ(" + decimal(-radius) + "px) ";

    // Apply the extra transformations
    transform += extraTransforms + " ";

    return transform;
  }
}

eventEmitter(RectilinearView);

/**
 * Factory functions for view limiters. See {@link RectilinearViewLimiter}.
 * @namespace
 */
RectilinearView.limit = {
  /**
   * Returns a view limiter that constrains the yaw angle.
   * @param {number} min The minimum yaw value.
   * @param {number} max The maximum yaw value.
   * @return {RectilinearViewLimiter}
   */
  yaw: function (min, max) {
    return function limitYaw(params) {
      params.yaw = clamp(params.yaw, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the pitch angle.
   * @param {number} min The minimum pitch value.
   * @param {number} max The maximum pitch value.
   * @return {RectilinearViewLimiter}
   */
  pitch: function (min, max) {
    return function limitPitch(params) {
      params.pitch = clamp(params.pitch, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the roll angle.
   * @param {number} min The minimum roll value.
   * @param {number} max The maximum roll value.
   * @return {RectilinearViewLimiter}
   */
  roll: function (min, max) {
    return function limitRoll(params) {
      params.roll = clamp(params.roll, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the horizontal field of view.
   * @param {number} min The minimum horizontal field of view.
   * @param {number} max The maximum horizontal field of view.
   * @return {RectilinearViewLimiter}
   */
  hfov: function (min, max) {
    return function limitHfov(params) {
      var width = params.width;
      var height = params.height;
      if (width > 0 && height > 0) {
        var vmin = convertFov.htov(min, width, height);
        var vmax = convertFov.htov(max, width, height);
        params.fov = clamp(params.fov, vmin, vmax);
      }
      return params;
    };
  },

  /**
   * Returns a view limiter that constrains the vertical field of view.
   * @param {number} min The minimum vertical field of view.
   * @param {number} max The maximum vertical field of view.
   * @return {RectilinearViewLimiter}
   */
  vfov: function (min, max) {
    return function limitVfov(params) {
      params.fov = clamp(params.fov, min, max);
      return params;
    };
  },

  /**
   * Returns a view limiter that prevents zooming in beyond the given
   * resolution.
   * @param {number} size The cube face width in pixels or, equivalently, one
   *     fourth of the equirectangular width in pixels.
   * @return {RectilinearViewLimiter}
   */
  resolution: function (size) {
    return function limitResolution(params) {
      var height = params.height;
      if (height) {
        var requiredPixels = pixelRatio() * height;
        var minFov = 2 * Math.atan(requiredPixels / size);
        params.fov = clamp(params.fov, minFov, Infinity);
      }
      return params;
    };
  },

  /**
   * Returns a view limiter that limits the horizontal and vertical field of
   * view, prevents zooming in past the image resolution, and limits the pitch
   * range to prevent the camera wrapping around at the poles. These are the
   * most common view constraints for a 360° panorama.
   * @param {number} maxResolution The cube face width in pixels or,
   *     equivalently, one fourth of the equirectangular width in pixels.
   * @param {number} maxVFov The maximum vertical field of view.
   * @param {number} [maxHFov=maxVFov] The maximum horizontal field of view.
   * @return {RectilinearViewLimiter}
   */
  traditional: function (maxResolution, maxVFov, maxHFov) {
    maxHFov = maxHFov != null ? maxHFov : maxVFov;

    return compose(
      RectilinearView.limit.resolution(maxResolution),
      RectilinearView.limit.vfov(0, maxVFov),
      RectilinearView.limit.hfov(0, maxHFov),
      RectilinearView.limit.pitch(-Math.PI / 2, Math.PI / 2)
    );
  },
};

// TODO: check if this is still needed and how this can be expressed in typescript
// @ts-ignore
RectilinearView.type = RectilinearView.prototype.type = "rectilinear";

export default RectilinearView;
