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
  friction: 6,
  maxFrictionTime: 0.3,
  hammerEvent: 'pan',
};

// TODO: figure out where this was coming from
// @ts-ignore
const debug = typeof MARZIPANODEBUG !== 'undefined' && MARZIPANODEBUG.controls;

/**
 * @class DragControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Controls the view by clicking/tapping and dragging.
 *
 * @param {Element} element Element to listen for events.
 * @param {string} pointerType Which Hammer.js pointer type to use (e.g.
 * `mouse` or `touch`).
 * @param {Object} opts
 * @param {number} opts.friction
 * @param {number} opts.maxFrictionTime
 * @param {'pan'|'pinch'} opts.hammerEvent
 */
class DragControlMethod {
  #element: any;
  #opts: { [x: string]: any };
  #startEvent: null | boolean | PointerEvent;
  #lastEvent: null | boolean | PointerEvent;
  #active: boolean;
  #dynamics: { x: Dynamics; y: Dynamics };
  #hammer: HammerGesturesHandle;

  constructor(
    element: Element,
    pointerType: string,
    opts?: { hammerEvent: string }
  ) {
    this.#element = element;

    this.#opts = defaults(opts || {}, defaultOptions);

    this.#startEvent = null;
    this.#lastEvent = null;

    this.#active = false;

    this.#dynamics = {
      x: new Dynamics(),
      y: new Dynamics(),
    };

    this.#hammer = HammerGestures.get(element, pointerType);

    this.#hammer.on('hammer.input', this.#handleHammerEvent.bind(this));

    if (this.#opts.hammerEvent != 'pan' && this.#opts.hammerEvent != 'pinch') {
      throw new Error(
        this.#opts.hammerEvent +
          ' is not a hammerEvent managed in DragControlMethod'
      );
    }

    this.#hammer.on(
      this.#opts.hammerEvent + 'start',
      this.#handleStart.bind(this)
    );
    this.#hammer.on(
      this.#opts.hammerEvent + 'move',
      this.#handleMove.bind(this)
    );
    this.#hammer.on(this.#opts.hammerEvent + 'end', this.#handleEnd.bind(this));
    this.#hammer.on(
      this.#opts.hammerEvent + 'cancel',
      this.#handleEnd.bind(this)
    );
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#hammer.release();
    clearOwnProperties(this);
  }
  #handleHammerEvent(e) {
    if (e.isFirst) {
      if (debug && this.#active) {
        throw new Error(
          'DragControlMethod active detected when already active'
        );
      }
      this.#active = true;
      this.emit('active');
    }
    if (e.isFinal) {
      if (debug && !this.#active) {
        throw new Error(
          'DragControlMethod inactive detected when already inactive'
        );
      }
      this.#active = false;
      this.emit('inactive');
    }
  }
  emit(_arg0: string) {
    throw new Error('Method not implemented.');
  }
  #handleStart(e) {
    // Prevent this event from dragging other DOM elements, causing
    // unexpected behavior on Chrome.
    e.preventDefault();

    this.#startEvent = e;
  }
  #handleMove(e) {
    // Prevent this event from dragging other DOM elements, causing
    // unexpected behavior on Chrome.
    e.preventDefault();

    if (this.#startEvent) {
      this.#updateDynamicsMove(e);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit('parameterDynamics', 'axisScaledX', this.#dynamics.x);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit('parameterDynamics', 'axisScaledY', this.#dynamics.y);
    }
  }
  #handleEnd(e) {
    // Prevent this event from dragging other DOM elements, causing
    // unexpected behavior on Chrome.
    e.preventDefault();

    if (this.#startEvent) {
      this.#updateDynamicsRelease(e);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit('parameterDynamics', 'axisScaledX', this.#dynamics.x);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit('parameterDynamics', 'axisScaledY', this.#dynamics.y);
    }

    this.#startEvent = false;
    this.#lastEvent = false;
  }
  #updateDynamicsMove(e) {
    let x = e.deltaX;
    let y = e.deltaY;

    // When a second finger touches the screen, panstart sometimes has a large
    // offset at start; subtract that offset to prevent a sudden jump.
    const eventToSubtract = this.#lastEvent || this.#startEvent;

    if (eventToSubtract) {
      // TODO: better type checks
      // @ts-ignore
      x -= eventToSubtract.deltaX;
      // TODO: better type checks
      // @ts-ignore
      y -= eventToSubtract.deltaY;
    }

    const elementRect = this.#element.getBoundingClientRect();
    const width = elementRect.right - elementRect.left;
    const height = elementRect.bottom - elementRect.top;

    x /= width;
    y /= height;

    this.#dynamics.x.reset();
    this.#dynamics.y.reset();
    this.#dynamics.x.offset = -x;
    this.#dynamics.y.offset = -y;

    this.#lastEvent = e;
  }
  #updateDynamicsRelease(e) {
    const elementRect = this.#element.getBoundingClientRect();
    const width = elementRect.right - elementRect.left;
    const height = elementRect.bottom - elementRect.top;

    const x = (1000 * e.velocityX) / width;
    const y = (1000 * e.velocityY) / height;

    this.#dynamics.x.reset();
    this.#dynamics.y.reset();
    this.#dynamics.x.velocity = x;
    this.#dynamics.y.velocity = y;

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
}

eventEmitter(DragControlMethod);

var tmpReleaseFriction: [null, null] = [null, null];

export default DragControlMethod;
