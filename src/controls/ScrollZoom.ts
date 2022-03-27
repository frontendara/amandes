import eventEmitter from "minimal-event-emitter";
import Dynamics from "./Dynamics";
import defaults from "../util/defaults";
import clearOwnProperties from "../util/clearOwnProperties";

var defaultOptions = {
  frictionTime: 0.2,
  zoomDelta: 0.001
};

/**
 * @class ScrollZoomControlMethod
 * @implements ControlMethod
 * @classdesc
 *
 * Controls the fov/zoom through the mouse wheel.
 *
 * @param {Element} element Element to listen for events.
 * @param {Object} opts
 * @param {number} [opts.frictionTime=0.2]
 * @param {number} [opts.zoomDelta=0.001]
 */
class ScrollZoomControlMethod {
  #element: any;
  #opts: { [x: string]: any; };
  #dynamics: Dynamics;
  #eventList: any[];
  #wheelListener: (e: any) => void;

  constructor(element: Element, opts?: any) {
    this.#element = element;
    this.#opts = defaults(opts || {}, defaultOptions);
    this.#dynamics = new Dynamics();
    this.#eventList = [];

    var fn = this.#opts.frictionTime ? this.withSmoothing : this.withoutSmoothing;
    this.#wheelListener = fn.bind(this);

    element.addEventListener('wheel', this.#wheelListener);
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#element.removeEventListener('wheel', this.#wheelListener);
    clearOwnProperties(this);
  }
  withoutSmoothing(e) {
    this.#dynamics.offset = wheelEventDelta(e) * this.#opts.zoomDelta;
    this.emit('parameterDynamics', 'zoom', this.#dynamics);

    e.preventDefault();

    this.emit('active');
    this.emit('inactive');
  }
  emit(_arg0: string, _arg1?: string, _dynamics?: any) {
    throw new Error("Method not implemented.");
  }
  withSmoothing(e) {
    var currentTime = e.timeStamp;

    // Record event.
    this.#eventList.push(e);

    // Remove events whose smoothing has already expired.
    while (this.#eventList[0].timeStamp < currentTime - this.#opts.frictionTime * 1000) {
      // TODO: figure out what's up with 0
      // @ts-ignore
      this.#eventList.shift(0);
    }

    // Get the current velocity from the recorded events.
    // Each wheel movement causes a velocity of change/frictionTime during frictionTime.
    var velocity = 0;
    for (var i = 0; i < this.#eventList.length; i++) {
      var zoomChangeFromEvent = wheelEventDelta(this.#eventList[i]) * this.#opts.zoomDelta;
      velocity += zoomChangeFromEvent / this.#opts.frictionTime;
    }

    this.#dynamics.velocity = velocity;
    this.#dynamics.friction = Math.abs(velocity) / this.#opts.frictionTime;

    this.emit('parameterDynamics', 'zoom', this.#dynamics);

    e.preventDefault();

    this.emit('active');
    this.emit('inactive');
  }
}

eventEmitter(ScrollZoomControlMethod);

function wheelEventDelta(e) {
  var multiplier = e.deltaMode == 1 ? 20 : 1;
  return e.deltaY * multiplier;
}


export default ScrollZoomControlMethod;
