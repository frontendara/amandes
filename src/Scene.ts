// TODO: issues in constructor awith event emitter emit when using typescript
import Layer from "./Layer";
import TextureStore from "./TextureStore";
import HotspotContainer from "./HotspotContainer";
import eventEmitter from "minimal-event-emitter";
import now from "./util/now";
import noop from "./util/noop";
import type from "./util/type";
import defaults from "./util/defaults";
import clearOwnProperties from "./util/clearOwnProperties";
import Viewer from "./Viewer";
import RectilinearView, { RectilinearViewCoords } from "./views/Rectilinear";
import FlatView from "./views/Flat";

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
  _viewer: Viewer;
  _view: View;
  _layers: Layer[];
  _hotspotContainer: HotspotContainer;
  _movement: null;
  _movementStartTime: null | number;
  _movementStep: any;
  _movementParams: any;
  _movementCallback: any;
  _updateMovementHandler: () => void;
  _updateHotspotContainerHandler: () => void;
  _viewChangeHandler: () => void;

  constructor(viewer: Viewer, view: View) {
    this._viewer = viewer;
    this._view = view;
    this._layers = [];

    // Hotspot container. Assume it occupies a full rect.
    this._hotspotContainer = new HotspotContainer(
      viewer._controlContainer,
      viewer.stage(),
      this._view,
      viewer.renderLoop()
    );

    // The current movement.
    this._movement = null;
    this._movementStartTime = null;
    this._movementStep = null;
    this._movementParams = null;
    this._movementCallback = null;

    // Event listener for updating the view according to the current movement.
    // The listener is set/unset on the render loop when a movement starts/stops.
    this._updateMovementHandler = this._updateMovement.bind(this);

    // Show or hide hotspots when scene changes.
    this._updateHotspotContainerHandler =
      this._updateHotspotContainer.bind(this);
    this._viewer.addEventListener(
      "sceneChange",
      this._updateHotspotContainerHandler
    );

    // Emit event when view changes.
    this._viewChangeHandler = this.emit.bind(this, "viewChange");
    // TODO: fix this event emitter issue
    // @ts-ignore
    this._view.addEventListener("change", this._viewChangeHandler);

    // Update the hotspot container.
    this._updateHotspotContainer();
  }
  /**
   * Destructor. Clients should call {@link Viewer#destroyScene} instead.
   */
  destroy() {
    // TODO: fix this event emitter issue
    // @ts-ignore

    this._view.removeEventListener("change", this._viewChangeHandler);
    // TODO: fix this event emitter issue
    // @ts-ignore
    this._viewer.removeEventListener(
      "sceneChange",
      this._updateHotspotContainerHandler
    );

    if (this._movement) {
      this.stopMovement();
    }

    this._hotspotContainer.destroy();

    this.destroyAllLayers();

    clearOwnProperties(this);
  }
  /**
   * Returns the {@link HotspotContainer hotspot container} for the scene.
   * @return {HotspotContainer}
   */
  hotspotContainer() {
    return this._hotspotContainer;
  }
  /**
   * Returns the first of the {@link Layer layers} belonging to the scene, or
   * null if the scene has no layers.
   *
   * This method is equivalent to `Scene#listLayers[0]`. It may be removed in the
   * future.
   *
   * @return {Layer}
   */
  layer() {
    return this._layers[0];
  }
  /**
   * Returns a list of all {@link Layer layers} belonging to the scene. The
   * returned list is in display order, background to foreground.
   * @return {Layer[]}
   */
  listLayers() {
    return [...this._layers];
  }
  /**
   * Returns the scene's underlying {@link View view}.
   * @return {View}
   */
  view() {
    return this._view;
  }
  /**
   * Returns the {@link Viewer viewer} the scene belongs to.
   * @return {Viewer}
   */
  viewer() {
    return this._viewer;
  }
  /**
   * Returns whether the scene is currently visible.
   * @return {boolean}
   */
  visible() {
    return this._viewer.scene() === this;
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

    var textureStoreOpts = opts.textureStoreOpts || {};
    var layerOpts = opts.layerOpts || {};

    var source = opts.source;
    var geometry = opts.geometry;
    var view = this._view;
    var stage = this._viewer.stage();
    var textureStore = new TextureStore(source, stage, textureStoreOpts);
    var layer = new Layer(source, geometry, view, textureStore, layerOpts);

    this._layers.push(layer);

    if (opts.pinFirstLevel) {
      layer.pinFirstLevel();
    }

    // Signal that the layers have changed.
    this.emit("layerChange");

    return layer;
  }
  /**
   * Destroys a {@link Layer layer} and removes it from the scene.
   * @param {Layer} layer
   * @throws An error if the layer does not belong to the scene.
   */
  destroyLayer(layer) {
    var i = this._layers.indexOf(layer);
    if (i < 0) {
      throw new Error("No such layer in scene");
    }

    this._layers.splice(i, 1);

    // Signal that the layers have changed.
    this.emit("layerChange");

    layer.textureStore().destroy();
    layer.destroy();
  }
  /**
   * Destroys all {@link Layer layers} and removes them from the scene.
   */
  destroyAllLayers() {
    while (this._layers.length > 0) {
      this.destroyLayer(this._layers[0]);
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
    return this._viewer.switchScene(this, opts, done);
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
    var self = this;

    opts = opts || {};
    done = done || noop;

    if (type(params) !== "object") {
      throw new Error("Target view parameters must be an object");
    }

    // Quadratic in/out easing.
    var easeInOutQuad = function (k) {
      if ((k *= 2) < 1) {
        return 0.5 * k * k;
      }
      return -0.5 * (--k * (k - 2) - 1);
    };

    var ease = opts.ease != null ? opts.ease : easeInOutQuad;
    var controlsInterrupt =
      opts.controlsInterrupt != null ? opts.controlsInterrupt : false;
    var duration =
      opts.transitionDuration != null ? opts.transitionDuration : 1000;
    var shortest = opts.shortest != null ? opts.shortest : true;

    var view = this._view;

    var initialParams = view.parameters();

    var finalParams = {} as RectilinearViewCoords;
    defaults(finalParams, params);
    defaults(finalParams, initialParams);

    // Tween through the shortest path if requested.
    // The view must implement the normalizeToClosest() method.
    if (shortest && "normalizeToClosest" in view && view.normalizeToClosest) {
      view.normalizeToClosest(finalParams, finalParams);
    }

    var movement = function () {
      var finalUpdate = false;

      return function (params, elapsed) {
        if (elapsed >= duration && finalUpdate) {
          return null;
        }

        var delta = Math.min(elapsed / duration, 1);

        for (var param in params) {
          var start = initialParams[param];
          var end = finalParams[param];
          params[param] = start + ease(delta) * (end - start);
        }

        finalUpdate = elapsed >= duration;

        return params;
      };
    };

    var reenableControls = this._viewer.controls()?.enabled();

    if (!controlsInterrupt) {
      this._viewer.controls()?.disable();
    }

    this.startMovement(movement, function () {
      if (reenableControls) {
        self._viewer.controls()?.enable();
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
    var renderLoop = this._viewer.renderLoop();

    if (this._movement) {
      this.stopMovement();
    }

    var step = fn();
    if (typeof step !== "function") {
      throw new Error("Bad movement");
    }

    this._movement = fn;
    this._movementStep = step;
    this._movementStartTime = now();
    this._movementParams = {};
    this._movementCallback = done;

    // TODO: fix this event-emitter issue
    // @ts-ignore
    renderLoop.addEventListener("beforeRender", this._updateMovementHandler);
    renderLoop.renderOnNextFrame();
  }
  /**
   * Stops the current movement.
   */
  stopMovement() {
    var done = this._movementCallback;
    var renderLoop = this._viewer.renderLoop();

    if (!this._movement) {
      return;
    }

    // Clear state before calling done, to prevent an infinite loop when the
    // callback starts a new movement.
    this._movement = null;
    this._movementStep = null;
    this._movementStartTime = null;
    this._movementParams = null;
    this._movementCallback = null;

    // TODO: fix this event-emitter issue
    // @ts-ignore
    renderLoop.removeEventListener("beforeRender", this._updateMovementHandler);

    if (done) {
      done();
    }
  }
  /**
   * Returns the current movement.
   * @return {function}
   */
  movement() {
    return this._movement;
  }
  _updateMovement() {
    if (!this._movement) {
      throw new Error("Should not call update");
    }

    var renderLoop = this._viewer.renderLoop();
    var view = this._view;

    var elapsed = now() - Number(this._movementStartTime);
    var step = this._movementStep;
    var params = this._movementParams;

    params = view.parameters(params);
    params = step(params, elapsed);
    if (params == null) {
      this.stopMovement();
    } else {
      view.setParameters(params);
      renderLoop.renderOnNextFrame();
    }
  }
  _updateHotspotContainer() {
    if (this.visible()) {
      this._hotspotContainer.show();
    } else {
      this._hotspotContainer.hide();
    }
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
}

eventEmitter(Scene);

export default Scene;
