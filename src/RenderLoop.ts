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
  #stage: any;
  #running: boolean;
  #rendering: boolean;
  #requestHandle: null | number;
  #boundLoop: () => void;
  #renderInvalidHandler: () => void;
  constructor(stage) {

    const self = this;

    // The stage wrapped by the loop.
    this.#stage = stage;

    // Whether the loop is running.
    this.#running = false;

    // Whether the loop is currently rendering.
    this.#rendering = false;

    // The current requestAnimationFrame handle.
    this.#requestHandle = null;

    // The callback passed into requestAnimationFrame.
    this.#boundLoop = this.#loop.bind(this);

    // Handler for renderInvalid events emitted by the stage.
    this.#renderInvalidHandler = function () {
      // If we are already rendering, there's no need to schedule a new render
      // on the next frame.
      if (!self.#rendering) {
        self.renderOnNextFrame();
      }
    };

    // Handle renderInvalid events emitted by the stage.
    this.#stage.addEventListener('renderInvalid', this.#renderInvalidHandler);

  }
  /**
   * Destructor.
   */
  destroy() {
    this.stop();
    this.#stage.removeEventListener('renderInvalid', this.#renderInvalidHandler);
    clearOwnProperties(this);
  }
  /**
   * Returns the underlying stage.
   * @return {Stage}
   */
  stage() {
    return this.#stage;
  }
  /**
   * Starts the render loop.
   */
  start() {
    this.#running = true;
    this.renderOnNextFrame();
  }
  /**
   * Stops the render loop.
   */
  stop() {
    if (this.#requestHandle) {
      window.cancelAnimationFrame(this.#requestHandle);
      this.#requestHandle = null;
    }
    this.#running = false;
  }
  /**
   * Forces the stage to render on the next frame, even if its contents remain
   * valid. Does nothing if the loop is stopped.
   */
  renderOnNextFrame() {
    if (this.#running && !this.#requestHandle) {
      this.#requestHandle = window.requestAnimationFrame(this.#boundLoop);
    }
  }
  #loop() {
    if (!this.#running) {
      throw new Error('Render loop running while in stopped state');
    }
    this.#requestHandle = null;
    this.#rendering = true;
    this.emit('beforeRender');
    this.#rendering = false;
    this.#stage.render();
    this.emit('afterRender');
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
}

eventEmitter(RenderLoop);

export default RenderLoop;
