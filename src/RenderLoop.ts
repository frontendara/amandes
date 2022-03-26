import eventEmitter from "minimal-event-emitter";
import clearOwnProperties from "./util/clearOwnProperties";

/**
 * Signals that {@link Stage#render} is about to be called.
 * @event RenderLoop#beforeRender
 */

/**
 * Signals that {@link Stage#render} has just been called.
 * @event RenderLoop#afterRender
 */

/**
 * @class RenderLoop
 * @classdesc
 *
 * A RenderLoop wraps a {@link Stage} and calls {@link Stage#render} on the next
 * frame whenever it fires {@link Stage#renderInvalid}. It may be started and
 * stopped, and is initially in the stopped state, in which no call to
 * {@link Stage#render} occurs.
 *
 * @listens Stage#renderInvalid
 *
 * @param {Stage} stage
 */
class RenderLoop {
  _stage: any;
  _running: boolean;
  _rendering: boolean;
  _requestHandle: null | number;
  _boundLoop: () => void;
  _renderInvalidHandler: () => void;
  constructor(stage) {

    var self = this;

    // The stage wrapped by the loop.
    this._stage = stage;

    // Whether the loop is running.
    this._running = false;

    // Whether the loop is currently rendering.
    this._rendering = false;

    // The current requestAnimationFrame handle.
    this._requestHandle = null;

    // The callback passed into requestAnimationFrame.
    this._boundLoop = this._loop.bind(this);

    // Handler for renderInvalid events emitted by the stage.
    this._renderInvalidHandler = function () {
      // If we are already rendering, there's no need to schedule a new render
      // on the next frame.
      if (!self._rendering) {
        self.renderOnNextFrame();
      }
    };

    // Handle renderInvalid events emitted by the stage.
    this._stage.addEventListener('renderInvalid', this._renderInvalidHandler);

  }
  /**
   * Destructor.
   */
  destroy() {
    this.stop();
    this._stage.removeEventListener('renderInvalid', this._renderInvalidHandler);
    clearOwnProperties(this);
  }
  /**
   * Returns the underlying stage.
   * @return {Stage}
   */
  stage() {
    return this._stage;
  }
  /**
   * Starts the render loop.
   */
  start() {
    this._running = true;
    this.renderOnNextFrame();
  }
  /**
   * Stops the render loop.
   */
  stop() {
    if (this._requestHandle) {
      window.cancelAnimationFrame(this._requestHandle);
      this._requestHandle = null;
    }
    this._running = false;
  }
  /**
   * Forces the stage to render on the next frame, even if its contents remain
   * valid. Does nothing if the loop is stopped.
   */
  renderOnNextFrame() {
    if (this._running && !this._requestHandle) {
      this._requestHandle = window.requestAnimationFrame(this._boundLoop);
    }
  }
  _loop() {
    if (!this._running) {
      throw new Error('Render loop running while in stopped state');
    }
    this._requestHandle = null;
    this._rendering = true;
    this.emit('beforeRender');
    this._rendering = false;
    this._stage.render();
    this.emit('afterRender');
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
}

eventEmitter(RenderLoop);

export default RenderLoop;
