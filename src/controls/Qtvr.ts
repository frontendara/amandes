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
import defaults from '../util/defaults';
import { maxFriction as maxFriction } from './util';
import clearOwnProperties from '../util/clearOwnProperties';

const defaultOptions = {
  speed: 8,
  friction: 6,
  maxFrictionTime: 0.3,
};

/**
 * @class QtvrControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Controls the view by holding the mouse button down and moving it.
 * Also known as "QTVR" control mode.
 *
 * @param {Element} element Element to listen for events.
 * @param {string} pointerType Which Hammer.js pointer type to use (e.g.
 * `mouse` or `touch`).
 * @param {Object} opts
 * @param {number} opts.speed
 * @param {number} opts.friction
 * @param {number} opts.maxFrictionTime
 */
// TODO: allow speed not change linearly with distance to click spot.
// Quadratic or other would allow a larger speed range.
class QtvrControlMethod {
  #element: any;
  #opts: { [x: string]: any };
  #active: boolean;
  #dynamics: { x: Dynamics; y: Dynamics };
  #hammer: HammerGesturesHandle;

  constructor(element: Element, pointerType: string, opts?: undefined) {
    this.#element = element;

    this.#opts = defaults(opts || {}, defaultOptions);

    this.#active = false;

    this.#hammer = HammerGestures.get(element, pointerType);

    this.#dynamics = {
      x: new Dynamics(),
      y: new Dynamics(),
    };

    this.#hammer.on('panstart', this.#handleStart.bind(this));
    this.#hammer.on('panmove', this.#handleMove.bind(this));
    this.#hammer.on('panend', this.#handleRelease.bind(this));
    this.#hammer.on('pancancel', this.#handleRelease.bind(this));
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#hammer.release();
    clearOwnProperties(this);
  }
  #handleStart(e) {
    // Prevent event dragging other DOM elements and causing strange behavior on Chrome
    e.preventDefault();

    if (!this.#active) {
      this.#active = true;
      this.emit('active');
    }
  }
  emit(_arg0: string, _arg1?: any, _arg2?: any) {
    throw new Error('Method not implemented.');
  }
  #handleMove(e) {
    // Prevent event dragging other DOM elements and causing strange behavior on Chrome
    e.preventDefault();

    this.#updateDynamics(e, false);
  }
  #handleRelease(e) {
    // Prevent event dragging other DOM elements and causing strange behavior on Chrome
    e.preventDefault();

    this.#updateDynamics(e, true);

    if (this.#active) {
      this.#active = false;
      this.emit('inactive');
    }
  }
  #updateDynamics(e, release) {
    const elementRect = this.#element.getBoundingClientRect();
    const width = elementRect.right - elementRect.left;
    const height = elementRect.bottom - elementRect.top;
    const maxDim = Math.max(width, height);

    const x = (e.deltaX / maxDim) * this.#opts.speed;
    const y = (e.deltaY / maxDim) * this.#opts.speed;

    this.#dynamics.x.reset();
    this.#dynamics.y.reset();
    this.#dynamics.x.velocity = x;
    this.#dynamics.y.velocity = y;

    if (release) {
      maxFriction(
        this.#opts.friction,
        this.#dynamics.x.velocity,
        this.#dynamics.y.velocity,
        this.#opts.maxFrictionTime,
        tmpReleaseFriction
      );
      this.#dynamics.x.friction = tmpReleaseFriction[0];
      this.#dynamics.y.friction = tmpReleaseFriction[1];
    }

    this.emit('parameterDynamics', 'x', this.#dynamics.x);
    this.emit('parameterDynamics', 'y', this.#dynamics.y);
  }
}

eventEmitter(QtvrControlMethod);

var tmpReleaseFriction: [null, null] = [null, null];

export default QtvrControlMethod;
