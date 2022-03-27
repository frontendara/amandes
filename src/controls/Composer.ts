import eventEmitter from "minimal-event-emitter";
import Dynamics from "./Dynamics";
import now from "../util/now";
import clearOwnProperties from "../util/clearOwnProperties";

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
      "x",
      "y",
      "axisScaledX",
      "axisScaledY",
      "zoom",
      "yaw",
      "pitch",
      "roll",
    ];

    this.#now = opts.nowForTesting || now;

    this.#composedOffsets = {};

    this.#composeReturn = { offsets: this.#composedOffsets, changing: null };
  }
  add(instance) {
    if (this.has(instance)) {
      return;
    }

    var dynamics = {};
    this.#parameters.forEach(function (parameter) {
      dynamics[parameter] = {
        dynamics: new Dynamics(),
        time: null,
      };
    });

    var parameterDynamicsHandler = this.#updateDynamics.bind(this, dynamics);

    var method = {
      instance: instance,
      dynamics: dynamics,
      parameterDynamicsHandler: parameterDynamicsHandler,
    };

    instance.addEventListener("parameterDynamics", parameterDynamicsHandler);

    this.#methods.push(method);
  }
  remove(instance) {
    var index = this.#indexOfInstance(instance);
    if (index >= 0) {
      var method = this.#methods.splice(index, 1)[0];
      method.instance.removeEventListener(
        "parameterDynamics",
        method.parameterDynamicsHandler
      );
    }
  }
  has(instance) {
    return this.#indexOfInstance(instance) >= 0;
  }
  #indexOfInstance(instance) {
    for (var i = 0; i < this.#methods.length; i++) {
      if (this.#methods[i].instance === instance) {
        return i;
      }
    }
    return -1;
  }
  list() {
    var instances: unknown[] = [];
    for (var i = 0; i < this.#methods.length; i++) {
      instances.push(this.#methods[i].instance);
    }
    return instances;
  }
  #updateDynamics(storedDynamics, parameter, dynamics) {
    var parameterDynamics = storedDynamics[parameter];

    if (!parameterDynamics) {
      throw new Error("Unknown control parameter " + parameter);
    }

    var newTime = this.#now();
    parameterDynamics.dynamics.update(
      dynamics,
      (newTime - parameterDynamics.time) / 1000
    );
    parameterDynamics.time = newTime;

    this.emit("change");
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
  #resetComposedOffsets() {
    for (var i = 0; i < this.#parameters.length; i++) {
      this.#composedOffsets[this.#parameters[i]] = 0;
    }
  }
  offsets() {
    var parameter;
    var changing = false;

    var currentTime = this.#now();

    this.#resetComposedOffsets();

    for (var i = 0; i < this.#methods.length; i++) {
      var methodDynamics = this.#methods[i].dynamics;

      for (var p = 0; p < this.#parameters.length; p++) {
        parameter = this.#parameters[p];
        var parameterDynamics = methodDynamics[parameter];
        var dynamics = parameterDynamics.dynamics;

        // Add offset to composed offset
        if (dynamics.offset != null) {
          this.#composedOffsets[parameter] += dynamics.offset;
          // Reset offset
          dynamics.offset = null;
        }

        // Calculate offset from velocity and add it
        var elapsed = (currentTime - parameterDynamics.time) / 1000;
        var offsetFromVelocity = dynamics.offsetFromVelocity(elapsed);

        if (offsetFromVelocity) {
          this.#composedOffsets[parameter] += offsetFromVelocity;
        }

        // Update velocity on dynamics
        var currentVelocity = dynamics.velocityAfter(elapsed);
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
    var instances = this.list();
    for (var i = 0; i < instances.length; i++) {
      this.remove(instances[i]);
    }

    clearOwnProperties(this);
  }
}

eventEmitter(ControlComposer);

export default ControlComposer;
