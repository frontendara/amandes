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
import Dynamics from "./Dynamics";
import clearOwnProperties from "../util/clearOwnProperties";

/**
 * @class ElementPressControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Sets the velocity and friction of a single parameter by pressing and
 * unpressing a DOM element.
 *
 * @param {Element} element Element which activates the method when pressed
 * @param {string} parameter The parameter to be controlled (e.g. `x`, `y` or `zoom`)
 * @param {number} velocity Velocity at which the parameter changes. Use a
 * negative number for opposite direction
 * @param {number} friction Friction at which the parameter stops
*/
class ElementPressControlMethod {
  #element: any;
  #pressHandler: () => void;
  #releaseHandler: () => void;
  #parameter: any;
  #velocity: any;
  #friction: any;
  #dynamics: Dynamics;
  #pressing: boolean;
  constructor(element, parameter, velocity, friction) {
    if (!element) {
      throw new Error("ElementPressControlMethod: element must be defined");
    }
    if (!parameter) {
      throw new Error("ElementPressControlMethod: parameter must be defined");
    }
    if (!velocity) {
      throw new Error("ElementPressControlMethod: velocity must be defined");
    }
    if (!friction) {
      throw new Error("ElementPressControlMethod: friction must be defined");
    }

    this.#element = element;

    this.#pressHandler = this.#handlePress.bind(this);
    this.#releaseHandler = this.#handleRelease.bind(this);

    element.addEventListener('mousedown', this.#pressHandler);
    element.addEventListener('mouseup', this.#releaseHandler);
    element.addEventListener('mouseleave', this.#releaseHandler);
    element.addEventListener('touchstart', this.#pressHandler);
    element.addEventListener('touchmove', this.#releaseHandler);
    element.addEventListener('touchend', this.#releaseHandler);

    this.#parameter = parameter;
    this.#velocity = velocity;
    this.#friction = friction;
    this.#dynamics = new Dynamics();

    this.#pressing = false;
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#element.removeEventListener('mousedown', this.#pressHandler);
    this.#element.removeEventListener('mouseup', this.#releaseHandler);
    this.#element.removeEventListener('mouseleave', this.#releaseHandler);
    this.#element.removeEventListener('touchstart', this.#pressHandler);
    this.#element.removeEventListener('touchmove', this.#releaseHandler);
    this.#element.removeEventListener('touchend', this.#releaseHandler);
    clearOwnProperties(this);
  }
  #handlePress() {
    this.#pressing = true;

    this.#dynamics.velocity = this.#velocity;
    this.#dynamics.friction = 0;
    this.emit('parameterDynamics', this.#parameter, this.#dynamics);
    this.emit('active');
  }
  emit(_arg0: string, _parameter?: any, _dynamics?: any) {
    throw new Error("Method not implemented.");
  }
  #handleRelease() {
    if (this.#pressing) {
      this.#dynamics.friction = this.#friction;
      this.emit('parameterDynamics', this.#parameter, this.#dynamics);
      this.emit('inactive');
    }

    this.#pressing = false;
  }
}
eventEmitter(ElementPressControlMethod);

export default ElementPressControlMethod;
