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
import Dynamics from './Dynamics';
import HammerGestures, { HammerGesturesHandle } from './HammerGestures';
import clearOwnProperties from '../util/clearOwnProperties';

/**
 * @class PinchZoomControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Control the view fov/zoom by pinching with two fingers.
 *
 * @param {Element} element Element to listen for events.
 * @param {string} pointerType Which Hammer.js pointer type to use
 * @param {Object} opts
 */
class PinchZoomControlMethod {
  #lastEvent: null | { scale: number };
  #active: boolean;
  #dynamics: Dynamics;
  #hammer: HammerGesturesHandle;

  constructor(element, pointerType) {
    this.#hammer = HammerGestures.get(element, pointerType);

    this.#lastEvent = null;

    this.#active = false;

    this.#dynamics = new Dynamics();

    this.#hammer.on('pinchstart', this.#handleStart.bind(this));
    this.#hammer.on('pinch', this.#handleEvent.bind(this));
    this.#hammer.on('pinchend', this.#handleEnd.bind(this));
    this.#hammer.on('pinchcancel', this.#handleEnd.bind(this));
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#hammer.release();
    clearOwnProperties(this);
  }
  #handleStart() {
    if (!this.#active) {
      this.#active = true;
      this.emit('active');
    }
  }
  emit(_arg0: string, _parameter?: string, _dynamics?: Dynamics) {
    throw new Error('Method not implemented.');
  }
  #handleEnd() {
    this.#lastEvent = null;

    if (this.#active) {
      this.#active = false;
      this.emit('inactive');
    }
  }
  #handleEvent(e) {
    let scale = e.scale;

    if (this.#lastEvent) {
      scale /= this.#lastEvent.scale;
    }

    this.#dynamics.offset = (scale - 1) * -1;
    this.emit('parameterDynamics', 'zoom', this.#dynamics);

    this.#lastEvent = e;
  }
}

eventEmitter(PinchZoomControlMethod);

export default PinchZoomControlMethod;
