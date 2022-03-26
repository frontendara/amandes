import eventEmitter from "minimal-event-emitter";

import RenderLoop from "./RenderLoop";
import Controls from "./controls/Controls";
import Scene from "./Scene";
import Timer from "./Timer";

import WebGlStage from "./stages/WebGl";

import ControlCursor from "./controls/ControlCursor";
import HammerGestures, {
  HammerGesturesHandle,
} from "./controls/HammerGestures";

import registerDefaultControls from "./controls/registerDefaultControls";
import registerDefaultRenderers from "./renderers/registerDefaultRenderers";

import { setOverflowHidden as setOverflowHidden } from "./util/dom";
import { setAbsolute as setAbsolute } from "./util/dom";
import { setFullSize as setFullSize } from "./util/dom";

import tween from "./util/tween";
import noop from "./util/noop";
import clearOwnProperties from "./util/clearOwnProperties";
import Layer from "./Layer";

/**
 * Transition options.
 */
interface SwitchSceneOptions {
  /**
   * Transition duration, in milliseconds.
   */
  transitionDuration?: number;
  /**
   * Transition update function, with signature `f(t, newScene, oldScene)`.
   * This function is called on each frame with `t` increasing from 0 to 1.
   * An initial call with `t=0` and a final call with `t=1` are guaranteed.
   * The default function sets the opacity of the new scene to `t`.
   */
  transitionUpdate?: (val: number, newScene: Scene, oldScene: Scene) => void;
}

/**
 * Viewer creation options.
 */
interface ViewerOptions {
  /**
   * Options to be passed to {@link registerDefaultControls}.
   */
  controls?: Controls;
  /**
   * Options to be passed to the {@link Stage} constructor.
   */
  stage?: any;
  /**
   * Cursor options.
   */
  cursors?: {
    /**
     * Drag cursor options to be passed to the {@link ControlCursor} constructor.
     */
    drag?: any;
  };
}

/**
 * Signals that the current scene has changed.
 * @event Viewer#sceneChange
 */

/**
 * Signals that the view of the current scene has changed. See
 * {@link View#event:change}.
 * @event Viewer#viewChange
 */

/**
 * @class Viewer
 * @classdesc
 *
 * A Viewer is a container for multiple {@link Scene scenes} to be displayed
 * inside a {@link Stage stage} contained in the DOM.
 *
 * Scenes may be created by calling {@link Viewer#createScene}. Except during a
 * scene switch, a single one of them, called the current scene, is visible.
 * Calling {@link Viewer#switchScene} sets the current scene and switches to it.
 *
 * @param {Element} domElement The DOM element to contain the stage.
 */
class Viewer {
  _domElement: any;
  _stage: WebGlStage;
  _controlContainer: HTMLDivElement;
  _size: any;
  _updateSizeListener: () => void;
  _renderLoop: RenderLoop;
  _controls: Controls | null;
  _controlMethods: Record<string, any>;
  _hammerManagerTouch: HammerGesturesHandle;
  _hammerManagerMouse: HammerGesturesHandle;
  _dragCursor: ControlCursor;
  _scenes: Scene[];
  _currentScene: Scene | null;
  _replacedScene: Scene | null;
  _cancelCurrentTween: null | ReturnType<typeof tween>;
  _layerChangeHandler: () => void;
  _viewChangeHandler: any;
  _idleTimer: Timer;
  _resetIdleTimerHandler: () => void;
  _triggerIdleTimerHandler: () => void;
  _stopMovementHandler: () => void;
  _idleMovement: null;

  constructor(domElement: HTMLElement, opts?: ViewerOptions) {
    opts = opts || {};

    this._domElement = domElement;

    // Add `overflow: hidden` to the domElement.
    setOverflowHidden(domElement);

    // Create stage.
    this._stage = new WebGlStage(opts.stage);

    // Register the default renderers for the selected stage.
    registerDefaultRenderers(this._stage);

    // Add the stage element into the DOM.
    this._domElement.appendChild(this._stage.domElement());

    // Create control container.
    // Controls cannot be placed directly on the root DOM element because
    // Hammer.js will prevent click events from reaching the elements beneath.
    // The hotspot containers will be added inside the controls container.
    this._controlContainer = document.createElement("div");
    setAbsolute(this._controlContainer);
    setFullSize(this._controlContainer);
    domElement.appendChild(this._controlContainer);

    // Respond to window size changes.
    this._size = {};
    this.updateSize();
    this._updateSizeListener = this.updateSize.bind(this);
    window.addEventListener("resize", this._updateSizeListener);

    // Create render loop.
    this._renderLoop = new RenderLoop(this._stage);

    // Create the controls and register them with the render loop.
    this._controls = new Controls();
    this._controlMethods = registerDefaultControls(
      this._controls,
      this._controlContainer,
      // TODO: this needs investigation, it seems that what's passed here is not necessary
      // used inside of the registration
      opts.controls as any
    );
    this._controls.attach(this._renderLoop);

    // Expose HammerJS.
    this._hammerManagerTouch = HammerGestures.get(
      this._controlContainer,
      "touch"
    );
    this._hammerManagerMouse = HammerGestures.get(
      this._controlContainer,
      "mouse"
    );

    // Initialize drag cursor.
    this._dragCursor = new ControlCursor(
      this._controls,
      "mouseViewDrag",
      domElement,
      (opts.cursors && opts.cursors.drag) || {}
    );

    // Start the render loop.
    this._renderLoop.start();

    // Scene list.
    this._scenes = [];

    // The currently visible scene.
    // During a scene transition, this is the scene being switched to.
    this._currentScene = null;

    // The scene being switched from during a scene transition.
    // This is necessary to update the layers correctly when they are added or
    // removed during a transition.
    this._replacedScene = null;

    // The current transition.
    this._cancelCurrentTween = null;

    // The event listener fired when the current scene layers change.
    // This is attached to the correct scene whenever the current scene changes.
    this._layerChangeHandler = this._updateSceneLayers.bind(this);

    // The event listener fired when the current scene view changes.
    // This is attached to the correct scene whenever the current scene changes.
    this._viewChangeHandler = this.emit.bind(this, "viewChange");

    // Setup the idle timer.
    // By default, the timer has an infinite duration so it does nothing.
    this._idleTimer = new Timer();
    this._idleTimer.start();

    // Reset the timer whenever the view changes.
    this._resetIdleTimerHandler = this._resetIdleTimer.bind(this);
    this.addEventListener("viewChange", this._resetIdleTimerHandler);

    // Start the idle movement when the idle timer fires.
    this._triggerIdleTimerHandler = this._triggerIdleTimer.bind(this);
    // TODO: better type definitions for event emitters
    // @ts-ignore
    this._idleTimer.addEventListener("timeout", this._triggerIdleTimerHandler);

    // Stop an ongoing movement when the controls are activated or when the
    // scene changes.
    this._stopMovementHandler = this.stopMovement.bind(this);
    // TODO: better type definitions for event emitters
    // @ts-ignore
    this._controls.addEventListener("active", this._stopMovementHandler);
    this.addEventListener("sceneChange", this._stopMovementHandler);

    // The currently programmed idle movement.
    this._idleMovement = null;
  }
  addEventListener(_arg0: string, _resetIdleTimerHandler: any) {
    throw new Error("Method not implemented.");
  }
  /**
   * Destructor.
   */
  destroy() {
    window.removeEventListener("resize", this._updateSizeListener);

    if (this._currentScene) {
      this._removeSceneEventListeners(this._currentScene);
    }

    if (this._replacedScene) {
      this._removeSceneEventListeners(this._replacedScene);
    }

    this._dragCursor.destroy();

    for (var methodName in this._controlMethods) {
      this._controlMethods[methodName].destroy();
    }

    while (this._scenes.length) {
      this.destroyScene(this._scenes[0]);
    }

    this._domElement.removeChild(this._stage.domElement());

    this._stage.destroy();
    this._renderLoop.destroy();
    this._controls?.destroy();
    this._controls = null;

    if (this._cancelCurrentTween) {
      this._cancelCurrentTween();
    }

    clearOwnProperties(this);
  }
  /**
   * Updates the stage size to fill the containing element.
   *
   * This method is automatically called when the browser window is resized.
   * Most clients won't need to explicitly call it to keep the size up to date.
   */
  updateSize() {
    var size = this._size;
    size.width = this._domElement.clientWidth;
    size.height = this._domElement.clientHeight;
    this._stage.setSize(size);
  }
  /**
   * Returns the underlying {@link Stage stage}.
   * @return {Stage}
   */
  stage() {
    return this._stage;
  }
  /**
   * Returns the underlying {@link RenderLoop render loop}.
   * @return {RenderLoop}
   */
  renderLoop() {
    return this._renderLoop;
  }
  /**
   * Returns the underlying {@link Controls controls}.
   * @return {Controls}
   */
  controls() {
    return this._controls;
  }
  /**
   * Returns the underlying DOM element.
   * @return {Element}
   */
  domElement() {
    return this._domElement;
  }
  /**
   * Creates a new {@link Scene scene} with a single layer and adds it to the
   * viewer.
   *
   * The current scene does not change. To switch to the scene, call
   * {@link Viewer#switchScene}.
   *
   * @param {Object} opts Scene creation options.
   * @param {View} opts.view The scene's underlying {@link View}.
   * @param {Source} opts.source The layer's underlying {@link Source}.
   * @param {Geometry} opts.geometry The layer's underlying {@link Geometry}.
   * @param {boolean} [opts.pinFirstLevel=false] Whether to pin the first level to
   *     provide a fallback of last resort, at the cost of memory consumption.
   * @param {Object} [opts.textureStoreOpts={}] Options to pass to the
   *     {@link TextureStore} constructor.
   * @param {Object} [opts.layerOpts={}] Options to pass to the {@link Layer}
   *     constructor.
   * @return {Scene}
   */
  createScene(opts) {
    opts = opts || {};

    var scene = this.createEmptyScene({ view: opts.view });

    scene.createLayer({
      source: opts.source,
      geometry: opts.geometry,
      pinFirstLevel: opts.pinFirstLevel,
      textureStoreOpts: opts.textureStoreOpts,
      layerOpts: opts.layerOpts,
    });

    return scene;
  }
  /**
   * Creates a new {@link Scene scene} with no layers and adds it to the viewer.
   *
   * Layers may be added to the scene by calling {@link Scene#createLayer}.
   * However, if the scene has a single layer, it is simpler to call
   * {@link Viewer#createScene} instead of this method.
   *
   * The current scene does not change. To switch to the scene, call
   * {@link Viewer#switchScene}.
   *
   * @param {Object} opts Scene creation options.
   * @param {View} opts.view The scene's underlying {@link View}.
   * @return {Scene}
   */
  createEmptyScene(opts) {
    opts = opts || {};

    var scene = new Scene(this, opts.view);
    this._scenes.push(scene);

    return scene;
  }
  _updateSceneLayers() {
    var i;
    var layer;

    var stage = this._stage;
    var currentScene = this._currentScene;
    var replacedScene = this._replacedScene;

    var oldLayers = stage.listLayers();

    // The stage contains layers from at most two scenes: the current one, on top,
    // and the one currently being switched away from, on the bottom.
    var newLayers: Layer[] = [];
    if (replacedScene) {
      newLayers = newLayers.concat(replacedScene.listLayers());
    }
    if (currentScene) {
      newLayers = newLayers.concat(currentScene.listLayers());
    }

    // A single layer can be added or removed from the scene at a time.
    if (Math.abs(oldLayers.length - newLayers.length) !== 1) {
      throw new Error("Stage and scene out of sync");
    }

    if (newLayers.length < oldLayers.length) {
      // A layer was removed.
      for (i = 0; i < oldLayers.length; i++) {
        layer = oldLayers[i];
        if (newLayers.indexOf(layer) < 0) {
          this._removeLayerFromStage(layer);
          break;
        }
      }
    }
    if (newLayers.length > oldLayers.length) {
      // A layer was added.
      for (i = 0; i < newLayers.length; i++) {
        layer = newLayers[i];
        if (oldLayers.indexOf(layer) < 0) {
          this._addLayerToStage(layer, i);
        }
      }
    }

    // TODO: When in the middle of a scene transition, call the transition update
    // function immediately to prevent an added layer from flashing with the wrong
    // opacity.
  }
  _addLayerToStage(layer: Layer, i?: number) {
    // Pin the first level to ensure a fallback while the layer is visible.
    // Note that this is distinct from the `pinFirstLevel` option passed to
    // createScene(), which pins the layer even when it's not visible.
    layer.pinFirstLevel();
    this._stage.addLayer(layer, i);
  }
  _removeLayerFromStage(layer) {
    this._stage.removeLayer(layer);
    layer.unpinFirstLevel();
    layer.textureStore().clearNotPinned();
  }
  _addSceneEventListeners(scene) {
    scene.addEventListener("layerChange", this._layerChangeHandler);
    scene.addEventListener("viewChange", this._viewChangeHandler);
  }
  _removeSceneEventListeners(scene) {
    scene.removeEventListener("layerChange", this._layerChangeHandler);
    scene.removeEventListener("viewChange", this._viewChangeHandler);
  }
  /**
   * Destroys a {@link Scene scene} and removes it from the viewer.
   * @param {Scene} scene
   */
  destroyScene(scene) {
    var i = this._scenes.indexOf(scene);
    if (i < 0) {
      throw new Error("No such scene in viewer");
    }

    var j;
    var layers;

    if (this._currentScene === scene) {
      // The destroyed scene is the current scene.
      // Remove event listeners, remove layers from stage and cancel transition.
      this._removeSceneEventListeners(scene);
      layers = scene.listLayers();
      for (j = 0; j < layers.length; j++) {
        this._removeLayerFromStage(layers[j]);
      }
      if (this._cancelCurrentTween) {
        this._cancelCurrentTween();
        this._cancelCurrentTween = null;
      }
      this._currentScene = null;
      this.emit("sceneChange");
    }

    if (this._replacedScene === scene) {
      // The destroyed scene is being switched away from.
      // Remove event listeners and remove layers from stage.
      this._removeSceneEventListeners(scene);
      layers = scene.listLayers();
      for (j = 0; j < layers.length; j++) {
        this._removeLayerFromStage(layers[j]);
      }
      this._replacedScene = null;
    }

    this._scenes.splice(i, 1);

    scene.destroy();
  }
  /**
   * Destroys all {@link Scene scenes} and removes them from the viewer.
   */
  destroyAllScenes() {
    while (this._scenes.length > 0) {
      this.destroyScene(this._scenes[0]);
    }
  }
  /**
   * Returns whether the viewer contains a {@link Scene scene}.
   * @param {Scene} scene
   * @return {boolean}
   */
  hasScene(scene) {
    return this._scenes.indexOf(scene) >= 0;
  }
  /**
   * Returns a list of all {@link Scene scenes}.
   * @return {Scene[]}
   */
  listScenes() {
    return [...this._scenes];
  }
  /**
   * Returns the current {@link Scene scene}, or null if there isn't one.
   *
   * To change the current scene, call {@link Viewer#switchScene}.
   *
   * @return {Scene}
   */
  scene() {
    return this._currentScene;
  }
  /**
   * Returns the {@link View view} for the current {@link Scene scene}, or null
   * if there isn't one.
   * @return {View}
   */
  view() {
    var scene = this._currentScene;
    if (scene) {
      return scene.view();
    }
    return null;
  }
  /**
   * Tweens the {@link View view} for the current {@link Scene scene}.
   *
   * This method is equivalent to calling {@link Scene#lookTo} on the current
   * scene.
   *
   * @param {Object} opts Options to pass into {@link Scene#lookTo}.
   * @param {function} done Function to call when the tween is complete.
   */
  lookTo(params, opts, done) {
    // TODO: is it an error to call lookTo when no scene is displayed?
    var scene = this._currentScene;
    if (scene) {
      scene.lookTo(params, opts, done);
    }
  }
  /**
   * Starts a movement, possibly replacing the current movement.
   *
   * This method is equivalent to calling {@link Scene#startMovement} on the
   * current scene. If there is no current scene, this is a no-op.
   *
   * @param {function} fn The movement function.
   * @param {function} done Function to be called when the movement finishes or is
   *     interrupted.
   */
  startMovement(fn: Function, done?: Function) {
    var scene = this._currentScene;
    if (!scene) {
      return;
    }
    scene.startMovement(fn, done);
  }
  /**
   * Stops the current movement.
   *
   * This method is equivalent to calling {@link Scene#stopMovement} on the
   * current scene. If there is no current scene, this is a no-op.
   */
  stopMovement() {
    var scene = this._currentScene;
    if (!scene) {
      return;
    }
    scene.stopMovement();
  }
  /**
   * Returns the current movement.
   *
   * This method is equivalent to calling {@link Scene#movement} on the
   * current scene. If there is no current scene, this is a no-op.
   *
   * @return {function}
   */
  movement() {
    var scene = this._currentScene;
    if (!scene) {
      return;
    }
    return scene.movement();
  }
  /**
   * Schedules an idle movement to be automatically started when the view remains
   * unchanged for the given timeout period.
   *
   * Changing the view while the idle movement is active stops the movement and
   * schedules it to start again after the same timeout period. To disable it
   * permanently, call with a null movement or an infinite timeout.
   *
   * @param {number} timeout Timeout period in milliseconds.
   * @param {function} movement Automatic movement function, or null to disable.
   */
  setIdleMovement(timeout, movement) {
    this._idleTimer.setDuration(timeout);
    this._idleMovement = movement;
  }
  /**
   * Stops the idle movement. It will be started again after the timeout set by
   * {@link Viewer#setIdleMovement}.
   */
  breakIdleMovement() {
    this.stopMovement();
    this._resetIdleTimer();
  }
  _resetIdleTimer() {
    this._idleTimer.start();
  }
  _triggerIdleTimer() {
    var idleMovement = this._idleMovement;
    if (!idleMovement) {
      return;
    }
    this.startMovement(idleMovement);
  }
  /**
   * Switches to another {@link Scene scene} with a fade transition. This scene
   * becomes the current one.
   *
   * If a transition is already taking place, it is interrupted before the new one
   * starts.
   *
   * @param newScene The scene to switch to.
   * @param opts Transition options.
   * @param done Function to call when the transition finishes or is
   *     interrupted. If the new scene is equal to the old one, no transition
   *     takes place, but this function is still called.
   */
  switchScene(newScene: Scene, opts?: SwitchSceneOptions, done?: () => void) {
    var self = this;

    opts = opts || {};
    done = done || noop;

    var stage = this._stage;

    var oldScene = this._currentScene;

    // Do nothing if the target scene is the current one.
    if (oldScene === newScene) {
      done();
      return;
    }

    if (this._scenes.indexOf(newScene) < 0) {
      throw new Error("No such scene in viewer");
    }

    // Cancel an already ongoing transition. This ensures that the stage contains
    // layers from exactly one scene before the transition begins.
    if (this._cancelCurrentTween) {
      this._cancelCurrentTween();
      this._cancelCurrentTween = null;
    }

    var oldSceneLayers = oldScene ? oldScene.listLayers() : [];
    var newSceneLayers = newScene.listLayers();
    var stageLayers = stage.listLayers();

    // Check that the stage contains exactly as many layers as the current scene,
    // and that the top layer is the right one. If this test fails, either there
    // is a bug or the user tried to modify the stage concurrently.
    if (
      oldScene &&
      (stageLayers.length !== oldSceneLayers.length ||
        (stageLayers.length > 1 && stageLayers[0] != oldSceneLayers[0]))
    ) {
      throw new Error("Stage not in sync with viewer");
    }

    // Get the transition parameters.
    var duration =
      opts.transitionDuration != null
        ? opts.transitionDuration
        : defaultSwitchDuration;
    var update =
      opts.transitionUpdate != null
        ? opts.transitionUpdate
        : defaultTransitionUpdate;

    // Add new scene layers into the stage before starting the transition.
    for (var i = 0; i < newSceneLayers.length; i++) {
      this._addLayerToStage(newSceneLayers[i]);
    }

    // Update function to be called on every frame.
    function tweenUpdate(val) {
      // TODO: check if we can avoid `as` here
      update(val, newScene, oldScene as Scene);
    }

    // Once the transition is complete, remove old scene layers from the stage and
    // remove the event listeners. If the old scene was destroyed during the
    // transition, this has already been taken care of. Otherwise, we still need
    // to get a fresh copy of the scene's layers, since they might have changed
    // during the transition.
    function tweenDone() {
      if (self._replacedScene) {
        self._removeSceneEventListeners(self._replacedScene);
        oldSceneLayers = self._replacedScene.listLayers();
        for (var i = 0; i < oldSceneLayers.length; i++) {
          self._removeLayerFromStage(oldSceneLayers[i]);
        }
        self._replacedScene = null;
      }
      self._cancelCurrentTween = null;
      done?.();
    }

    // Store the cancelable for the transition.
    this._cancelCurrentTween = tween(duration, tweenUpdate, tweenDone);

    // Update the current and replaced scene.
    this._currentScene = newScene;
    this._replacedScene = oldScene;

    // Emit scene and view change events.
    this.emit("sceneChange");
    this.emit("viewChange");

    // Add event listeners to the new scene.
    // Note that event listeners can only be removed from the old scene once the
    // transition is complete, since layers might get added or removed in the
    // interim.
    this._addSceneEventListeners(newScene);
  }

  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
}

eventEmitter(Viewer);

var defaultSwitchDuration = 1000;

function defaultTransitionUpdate(val, newScene, _oldScene) {
  var layers = newScene.listLayers();
  layers.forEach(function (layer) {
    layer.mergeEffects({ opacity: val });
  });

  newScene._hotspotContainer.domElement().style.opacity = val;
}

export default Viewer;
