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
 * @class VelocityControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Sets the velocity and friction of a single parameter.
 *
 * The user should emit 'active' and 'inactive' events if required.
 *
 * @param {String} parameter The parameter to be controlled (e.g. `x`, `y` or `zoom`)
*/
class VelocityControlMethod {
  #parameter: any;
  #dynamics: Dynamics;

  constructor(parameter) {
    if (!parameter) {
      throw new Error("VelocityControlMethod: parameter must be defined");
    }

    this.#parameter = parameter;
    this.#dynamics = new Dynamics();
  }
  /**
   * Destructor.
   */
  destroy() {
    clearOwnProperties(this);
  }
  /**
   * Set the parameter's velocity.
   * @param {Number} velocity
   */
  setVelocity(velocity) {
    this.#dynamics.velocity = velocity;
    this.emit('parameterDynamics', this.#parameter, this.#dynamics);
  }
  emit(_arg0: string, _parameter: any, _dynamics: any) {
    throw new Error("Method not implemented.");
  }
  /**
   * Set the parameter's friction.
   * @param {Number} friction
   */
  setFriction(friction) {
    this.#dynamics.friction = friction;
    this.emit('parameterDynamics', this.#parameter, this.#dynamics);
  }
}
eventEmitter(VelocityControlMethod);

export default VelocityControlMethod;
