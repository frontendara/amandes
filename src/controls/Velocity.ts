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
