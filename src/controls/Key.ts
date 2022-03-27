import eventEmitter from "minimal-event-emitter";
import Dynamics from "./Dynamics";
import clearOwnProperties from "../util/clearOwnProperties";

/**
 * @class KeyControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Sets the velocity and friction of a single parameter by pressing and
 * unpressing a key.
 *
 * @param {number} keyCode Key which activates the method when pressed
 * @param {string} parameter The parameter to be controlled (e.g. `x`, `y` or `zoom`)
 * @param {number} velocity Velocity at which the parameter changes. Use a
 * negative number for opposite direction
 * @param {number} friction Friction at which the parameter stops
 * @param {Element} [element=document] DOM element where the key events are listened to
 */
class KeyControlMethod {
  #keyCode: any;
  #parameter: any;
  #velocity: any;
  #friction: any;
  #element: any;
  #keydownHandler: (e: any) => void;
  #keyupHandler: (e: any) => void;
  #blurHandler: () => void;
  #dynamics: Dynamics;
  #pressing: boolean;

  constructor(keyCode: number, parameter: string, velocity: number, friction: number, element?: Document) {
    if (!keyCode) {
      throw new Error("KeyControlMethod: keyCode must be defined");
    }
    if (!parameter) {
      throw new Error("KeyControlMethod: parameter must be defined");
    }
    if (!velocity) {
      throw new Error("KeyControlMethod: velocity must be defined");
    }
    if (!friction) {
      throw new Error("KeyControlMethod: friction must be defined");
    }

    element = element || document;

    this.#keyCode = keyCode;
    this.#parameter = parameter;
    this.#velocity = velocity;
    this.#friction = friction;
    this.#element = element;

    this.#keydownHandler = this.#handlePress.bind(this);
    this.#keyupHandler = this.#handleRelease.bind(this);
    this.#blurHandler = this.#handleBlur.bind(this);

    this.#element.addEventListener('keydown', this.#keydownHandler);
    this.#element.addEventListener('keyup', this.#keyupHandler);
    window.addEventListener('blur', this.#blurHandler);

    this.#dynamics = new Dynamics();
    this.#pressing = false;
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#element.removeEventListener('keydown', this.#keydownHandler);
    this.#element.removeEventListener('keyup', this.#keyupHandler);
    window.removeEventListener('blur', this.#blurHandler);
    clearOwnProperties(this);
  }
  #handlePress(e) {
    if (e.keyCode !== this.#keyCode) { return; }

    this.#pressing = true;

    this.#dynamics.velocity = this.#velocity;
    this.#dynamics.friction = 0;
    this.emit('parameterDynamics', this.#parameter, this.#dynamics);
    this.emit('active');
  }
  emit(_arg0: string, _parameter?: any, _dynamics?: any) {
    throw new Error("Method not implemented.");
  }
  #handleRelease(e) {
    if (e.keyCode !== this.#keyCode) { return; }

    if (this.#pressing) {
      this.#dynamics.friction = this.#friction;
      this.emit('parameterDynamics', this.#parameter, this.#dynamics);
      this.emit('inactive');
    }

    this.#pressing = false;
  }
  #handleBlur() {
    this.#dynamics.velocity = 0;
    this.emit('parameterDynamics', this.#parameter, this.#dynamics);
    this.emit('inactive');

    this.#pressing = false;
  }
}
eventEmitter(KeyControlMethod);

export default KeyControlMethod;
