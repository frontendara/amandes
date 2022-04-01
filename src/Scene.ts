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

// TODO: issues in constructor awith event emitter emit when using typescript
import Layer from './Layer';
import TextureStore from './TextureStore';
import HotspotContainer from './HotspotContainer';
import eventEmitter from 'minimal-event-emitter';
import now from './util/now';
import noop from './util/noop';
import type from './util/type';
import defaults from './util/defaults';
import clearOwnProperties from './util/clearOwnProperties';
import Viewer from './Viewer';
import RectilinearView, { RectilinearViewCoords } from './views/Rectilinear';
import FlatView from './views/Flat';

type View = RectilinearView | FlatView;

/**
 * Signals that the scene's view has changed. See {@link View#event:change}.
 * @event Scene#viewChange
 */

/**
 * Signals that the scene's layers have changed.
 * @event Scene#layerChange
 */

/**
 * @class Scene
 * @classdesc
 *
 * A Scene is a stack of {@link Layer layers} sharing the same {@link View view}
 * and {@link HotspotContainer hotspot container}. It belongs to the
 * {@link Viewer viewer} inside which it is displayed.
 *
 * Clients should call {@link Viewer#createScene} instead of invoking the
 * constructor directly.
 *
 * @param viewer The viewer this scene belongs to.
 * @param view The scene's underlying view.
 */
class Scene {
  #viewer: Viewer;
  #view: View;
  #layers: Layer[];
  #hotspotContainer: HotspotContainer;
  #movement: null;
  #movementStartTime: null | number;
  #movementStep: any;
  #movementParams: any;
  #movementCallback: any;
  #updateMovementHandler: () => void;
  #updateHotspotContainerHandler: () => void;
  #viewChangeHandler: () => void;

  constructor(viewer: Viewer, view: View) {
    this.#viewer = viewer;
    this.#view = view;
    this.#layers = [];

    // Hotspot container. Assume it occupies a full rect.
    this.#hotspotContainer = new HotspotContainer(
      // TODO: should this be exposed?
      viewer._controlContainer,
      viewer.stage(),
      this.#view,
      viewer.renderLoop()
    );

    // The current movement.
    this.#movement = null;
    this.#movementStartTime = null;
    this.#movementStep = null;
    this.#movementParams = null;
    this.#movementCallback = null;

    // Event listener for updating the view according to the current movement.
    // The listener is set/unset on the render loop when a movement starts/stops.
    this.#updateMovementHandler = this.#updateMovement.bind(this);

    // Show or hide hotspots when scene changes.
    this.#updateHotspotContainerHandler =
      this.#updateHotspotContainer.bind(this);
    this.#viewer.addEventListener(
      'sceneChange',
      this.#updateHotspotContainerHandler
    );

    // Emit event when view changes.
    this.#viewChangeHandler = this.emit.bind(this, 'viewChange');
    // TODO: fix this event emitter issue
    // @ts-ignore
    this.#view.addEventListener('change', this.#viewChangeHandler);

    // Update the hotspot container.
    this.#updateHotspotContainer();
  }
  /**
   * Destructor. Clients should call {@link Viewer#destroyScene} instead.
   */
  destroy() {
    // TODO: fix this event emitter issue
    // @ts-ignore

    this.#view.removeEventListener('change', this.#viewChangeHandler);
    // TODO: fix this event emitter issue
    // @ts-ignore
    this.#viewer.removeEventListener(
      'sceneChange',
      this.#updateHotspotContainerHandler
    );

    if (this.#movement) {
      this.stopMovement();
    }

    this.#hotspotContainer.destroy();

    this.destroyAllLayers();

    clearOwnProperties(this);
  }
  /**
   * Returns the {@link HotspotContainer hotspot container} for the scene.
   */
  hotspotContainer() {
    return this.#hotspotContainer;
  }
  /**
   * Returns the first of the {@link Layer layers} belonging to the scene, or
   * null if the scene has no layers.
   *
   * This method is equivalent to `Scene#listLayers[0]`. It may be removed in the
   * future.
   */
  layer() {
    return this.#layers[0];
  }
  /**
   * Returns a list of all {@link Layer layers} belonging to the scene. The
   * returned list is in display order, background to foreground.
   * @return {Layer[]}
   */
  listLayers() {
    return [...this.#layers];
  }
  /**
   * Returns the scene's underlying {@link View view}.
   * @return {View}
   */
  view() {
    return this.#view;
  }
  /**
   * Returns the {@link Viewer viewer} the scene belongs to.
   * @return {Viewer}
   */
  viewer() {
    return this.#viewer;
  }
  /**
   * Returns whether the scene is currently visible.
   * @return {boolean}
   */
  visible() {
    return this.#viewer.scene() === this;
  }
  /**
   * Creates a new {@link Layer layer} and adds it into the scene in the
   * foreground position.
   *
   * @param {Object} opts Layer creation options.
   * @param {Source} opts.source The layer's underlying {@link Source}.
   * @param {Source} opts.geometry The layer's underlying {@link Geometry}.
   * @param {boolean} [opts.pinFirstLevel=false] Whether to pin the first level to
   *     provide a fallback of last resort, at the cost of memory consumption.
   * @param {Object} [opts.textureStoreOpts={}] Options to pass to the
   *     {@link TextureStore} constructor.
   * @param {Object} [opts.layerOpts={}] Options to pass to the {@link Layer}
   *     constructor.
   * @return {Layer}
   */
  createLayer(opts) {
    opts = opts || {};

    const textureStoreOpts = opts.textureStoreOpts || {};
    const layerOpts = opts.layerOpts || {};

    const source = opts.source;
    const geometry = opts.geometry;
    const view = this.#view;
    const stage = this.#viewer.stage();
    const textureStore = new TextureStore(source, stage, textureStoreOpts);
    const layer = new Layer(source, geometry, view, textureStore, layerOpts);

    this.#layers.push(layer);

    if (opts.pinFirstLevel) {
      layer.pinFirstLevel();
    }

    // Signal that the layers have changed.
    this.emit('layerChange');

    return layer;
  }
  /**
   * Destroys a {@link Layer layer} and removes it from the scene.
   * @param {Layer} layer
   * @throws An error if the layer does not belong to the scene.
   */
  destroyLayer(layer) {
    const i = this.#layers.indexOf(layer);
    if (i < 0) {
      throw new Error('No such layer in scene');
    }

    this.#layers.splice(i, 1);

    // Signal that the layers have changed.
    this.emit('layerChange');

    layer.textureStore().destroy();
    layer.destroy();
  }
  /**
   * Destroys all {@link Layer layers} and removes them from the scene.
   */
  destroyAllLayers() {
    while (this.#layers.length > 0) {
      this.destroyLayer(this.#layers[0]);
    }
  }
  /**
   * Switches to the scene.
   *
   * This is equivalent to calling {@link Viewer#switchScene} on this scene.
   *
   * @param {Object} [opts] Options to pass into {@link Viewer#switchScene}.
   * @param {function} [done] Function to call when the switch is complete.
   */
  switchTo(opts?: object, done?: () => void) {
    return this.#viewer.switchScene(this, opts, done);
  }
  /**
   * Tweens the scene's underlying {@link View view}.
   *
   * @param {Object} params Target view parameters.
   * @param {Object} opts Transition options.
   * @param {function} [opts.ease=easeInOutQuad] Tween easing function
   * @param {number} [opts.controlsInterrupt=false] allow controls to interrupt
   *     an ongoing tween.
   * @param {number} [opts.transitionDuration=1000] Tween duration, in
   *     milliseconds.
   * @param {number} [opts.closest=true] Whether to tween through the shortest
   *    path between the initial and final view parameters. This requires
   *    {@link View#normalizeToClosest} to be implemented, and does nothing
   *    otherwise.
   * @param {function} done Function to call when the tween finishes or is
   *    interrupted.
   */
  lookTo(params, opts, done) {
    const self = this;

    opts = opts || {};
    done = done || noop;

    if (type(params) !== 'object') {
      throw new Error('Target view parameters must be an object');
    }

    // Quadratic in/out easing.
    const easeInOutQuad = function (k) {
      if ((k *= 2) < 1) {
        return 0.5 * k * k;
      }
      return -0.5 * (--k * (k - 2) - 1);
    };

    const ease = opts.ease != null ? opts.ease : easeInOutQuad;
    const controlsInterrupt =
      opts.controlsInterrupt != null ? opts.controlsInterrupt : false;
    const duration =
      opts.transitionDuration != null ? opts.transitionDuration : 1000;
    const shortest = opts.shortest != null ? opts.shortest : true;

    const view = this.#view;

    const initialParams = view.parameters();

    const finalParams = {} as RectilinearViewCoords;
    defaults(finalParams, params);
    defaults(finalParams, initialParams);

    // Tween through the shortest path if requested.
    // The view must implement the normalizeToClosest() method.
    if (shortest && 'normalizeToClosest' in view && view.normalizeToClosest) {
      view.normalizeToClosest(finalParams, finalParams);
    }

    const movement = function () {
      let finalUpdate = false;

      return function (params, elapsed) {
        if (elapsed >= duration && finalUpdate) {
          return null;
        }

        const delta = Math.min(elapsed / duration, 1);

        for (const param in params) {
          const start = initialParams[param];
          const end = finalParams[param];
          params[param] = start + ease(delta) * (end - start);
        }

        finalUpdate = elapsed >= duration;

        return params;
      };
    };

    const reenableControls = this.#viewer.controls()?.enabled();

    if (!controlsInterrupt) {
      this.#viewer.controls()?.disable();
    }

    this.startMovement(movement, function () {
      if (reenableControls) {
        self.#viewer.controls()?.enable();
      }
      done();
    });
  }
  /**
   * Starts a movement, possibly replacing the current movement.
   *
   * @param {function} fn The movement function.
   * @param {function} done Function to be called when the movement finishes or is
   *     interrupted.
   */
  startMovement(fn, done) {
    const renderLoop = this.#viewer.renderLoop();

    if (this.#movement) {
      this.stopMovement();
    }

    const step = fn();
    if (typeof step !== 'function') {
      throw new Error('Bad movement');
    }

    this.#movement = fn;
    this.#movementStep = step;
    this.#movementStartTime = now();
    this.#movementParams = {};
    this.#movementCallback = done;

    // TODO: fix this event-emitter issue
    // @ts-ignore
    renderLoop.addEventListener('beforeRender', this.#updateMovementHandler);
    renderLoop.renderOnNextFrame();
  }
  /**
   * Stops the current movement.
   */
  stopMovement() {
    const done = this.#movementCallback;
    const renderLoop = this.#viewer.renderLoop();

    if (!this.#movement) {
      return;
    }

    // Clear state before calling done, to prevent an infinite loop when the
    // callback starts a new movement.
    this.#movement = null;
    this.#movementStep = null;
    this.#movementStartTime = null;
    this.#movementParams = null;
    this.#movementCallback = null;

    // TODO: fix this event-emitter issue
    // @ts-ignore
    renderLoop.removeEventListener('beforeRender', this.#updateMovementHandler);

    if (done) {
      done();
    }
  }
  /**
   * Returns the current movement.
   * @return {function}
   */
  movement() {
    return this.#movement;
  }
  #updateMovement() {
    if (!this.#movement) {
      throw new Error('Should not call update');
    }

    const renderLoop = this.#viewer.renderLoop();
    const view = this.#view;

    const elapsed = now() - Number(this.#movementStartTime);
    const step = this.#movementStep;
    let params = this.#movementParams;

    params = view.parameters(params);
    params = step(params, elapsed);
    if (params == null) {
      this.stopMovement();
    } else {
      view.setParameters(params);
      renderLoop.renderOnNextFrame();
    }
  }
  #updateHotspotContainer() {
    if (this.visible()) {
      this.#hotspotContainer.show();
    } else {
      this.#hotspotContainer.hide();
    }
  }
  emit(_arg0: string) {
    throw new Error('Method not implemented.');
  }
}

eventEmitter(Scene);

export default Scene;
