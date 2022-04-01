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
import now from '../util/now';
import clearOwnProperties from '../util/clearOwnProperties';

/**
 * @class ControlComposer
 * @classdesc
 *
 * Combines changes in parameters triggered by multiple {@link ControlMethod}
 * instances.
 *
 * @listens ControlMethod#parameterDynamics
 */
class ControlComposer {
  #methods: Array<{
    instance: any;
    dynamics: any;
    parameterDynamicsHandler: (parameter: string, dynamics: Dynamics) => void;
  }>;
  #parameters: string[];
  #now: any;
  #composedOffsets: {};
  #composeReturn: { offsets: any; changing: null | boolean };
  constructor(opts?: { nowForTesting?: any } | undefined) {
    opts = opts || {};

    this.#methods = [];

    this.#parameters = [
      'x',
      'y',
      'axisScaledX',
      'axisScaledY',
      'zoom',
      'yaw',
      'pitch',
      'roll',
    ];

    this.#now = opts.nowForTesting || now;

    this.#composedOffsets = {};

    this.#composeReturn = { offsets: this.#composedOffsets, changing: null };
  }
  add(instance) {
    if (this.has(instance)) {
      return;
    }

    const dynamics = {};
    this.#parameters.forEach(function (parameter) {
      dynamics[parameter] = {
        dynamics: new Dynamics(),
        time: null,
      };
    });

    const parameterDynamicsHandler = this.#updateDynamics.bind(this, dynamics);

    const method = {
      instance: instance,
      dynamics: dynamics,
      parameterDynamicsHandler: parameterDynamicsHandler,
    };

    instance.addEventListener('parameterDynamics', parameterDynamicsHandler);

    this.#methods.push(method);
  }
  remove(instance) {
    const index = this.#indexOfInstance(instance);
    if (index >= 0) {
      const method = this.#methods.splice(index, 1)[0];
      method.instance.removeEventListener(
        'parameterDynamics',
        method.parameterDynamicsHandler
      );
    }
  }
  has(instance) {
    return this.#indexOfInstance(instance) >= 0;
  }
  #indexOfInstance(instance) {
    for (let i = 0; i < this.#methods.length; i++) {
      if (this.#methods[i].instance === instance) {
        return i;
      }
    }
    return -1;
  }
  list() {
    const instances: unknown[] = [];
    for (let i = 0; i < this.#methods.length; i++) {
      instances.push(this.#methods[i].instance);
    }
    return instances;
  }
  #updateDynamics(storedDynamics, parameter, dynamics) {
    const parameterDynamics = storedDynamics[parameter];

    if (!parameterDynamics) {
      throw new Error('Unknown control parameter ' + parameter);
    }

    const newTime = this.#now();
    parameterDynamics.dynamics.update(
      dynamics,
      (newTime - parameterDynamics.time) / 1000
    );
    parameterDynamics.time = newTime;

    this.emit('change');
  }
  emit(_arg0: string) {
    throw new Error('Method not implemented.');
  }
  #resetComposedOffsets() {
    for (let i = 0; i < this.#parameters.length; i++) {
      this.#composedOffsets[this.#parameters[i]] = 0;
    }
  }
  offsets() {
    let parameter;
    let changing = false;

    const currentTime = this.#now();

    this.#resetComposedOffsets();

    for (let i = 0; i < this.#methods.length; i++) {
      const methodDynamics = this.#methods[i].dynamics;

      for (let p = 0; p < this.#parameters.length; p++) {
        parameter = this.#parameters[p];
        const parameterDynamics = methodDynamics[parameter];
        const dynamics = parameterDynamics.dynamics;

        // Add offset to composed offset
        if (dynamics.offset != null) {
          this.#composedOffsets[parameter] += dynamics.offset;
          // Reset offset
          dynamics.offset = null;
        }

        // Calculate offset from velocity and add it
        const elapsed = (currentTime - parameterDynamics.time) / 1000;
        const offsetFromVelocity = dynamics.offsetFromVelocity(elapsed);

        if (offsetFromVelocity) {
          this.#composedOffsets[parameter] += offsetFromVelocity;
        }

        // Update velocity on dynamics
        const currentVelocity = dynamics.velocityAfter(elapsed);
        dynamics.velocity = currentVelocity;

        // If there is still a velocity, set changing
        if (currentVelocity) {
          changing = true;
        }

        parameterDynamics.time = currentTime;
      }
    }

    this.#composeReturn.changing = changing;
    return this.#composeReturn;
  }
  destroy() {
    const instances = this.list();
    for (let i = 0; i < instances.length; i++) {
      this.remove(instances[i]);
    }

    clearOwnProperties(this);
  }
}

eventEmitter(ControlComposer);

export default ControlComposer;
