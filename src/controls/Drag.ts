import eventEmitter from "minimal-event-emitter";
import Dynamics from "./Dynamics";
import HammerGestures, { HammerGesturesHandle } from "./HammerGestures";
import defaults from "../util/defaults";
import { maxFriction as maxFriction } from "./util";
import clearOwnProperties from "../util/clearOwnProperties";

var defaultOptions = {
  friction: 6,
  maxFrictionTime: 0.3,
  hammerEvent: "pan",
};

// TODO: figure out where this was coming from
// @ts-ignore
var debug = typeof MARZIPANODEBUG !== "undefined" && MARZIPANODEBUG.controls;

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

  constructor(element: Element, pointerType: string, opts?: { hammerEvent: string; }) {
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

    this.#hammer.on("hammer.input", this.#handleHammerEvent.bind(this));

    if (this.#opts.hammerEvent != "pan" && this.#opts.hammerEvent != "pinch") {
      throw new Error(
        this.#opts.hammerEvent +
          " is not a hammerEvent managed in DragControlMethod"
      );
    }

    this.#hammer.on(
      this.#opts.hammerEvent + "start",
      this.#handleStart.bind(this)
    );
    this.#hammer.on(
      this.#opts.hammerEvent + "move",
      this.#handleMove.bind(this)
    );
    this.#hammer.on(this.#opts.hammerEvent + "end", this.#handleEnd.bind(this));
    this.#hammer.on(
      this.#opts.hammerEvent + "cancel",
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
          "DragControlMethod active detected when already active"
        );
      }
      this.#active = true;
      this.emit("active");
    }
    if (e.isFinal) {
      if (debug && !this.#active) {
        throw new Error(
          "DragControlMethod inactive detected when already inactive"
        );
      }
      this.#active = false;
      this.emit("inactive");
    }
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
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
      this.emit("parameterDynamics", "axisScaledX", this.#dynamics.x);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit("parameterDynamics", "axisScaledY", this.#dynamics.y);
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
      this.emit("parameterDynamics", "axisScaledX", this.#dynamics.x);
      // TODO: fix these emitter issues
      // @ts-ignore
      this.emit("parameterDynamics", "axisScaledY", this.#dynamics.y);
    }

    this.#startEvent = false;
    this.#lastEvent = false;
  }
  #updateDynamicsMove(e) {
    var x = e.deltaX;
    var y = e.deltaY;

    // When a second finger touches the screen, panstart sometimes has a large
    // offset at start; subtract that offset to prevent a sudden jump.
    var eventToSubtract = this.#lastEvent || this.#startEvent;

    if (eventToSubtract) {
      // TODO: better type checks
      // @ts-ignore
      x -= eventToSubtract.deltaX;
      // TODO: better type checks
      // @ts-ignore
      y -= eventToSubtract.deltaY;
    }

    var elementRect = this.#element.getBoundingClientRect();
    var width = elementRect.right - elementRect.left;
    var height = elementRect.bottom - elementRect.top;

    x /= width;
    y /= height;

    this.#dynamics.x.reset();
    this.#dynamics.y.reset();
    this.#dynamics.x.offset = -x;
    this.#dynamics.y.offset = -y;

    this.#lastEvent = e;
  }
  #updateDynamicsRelease(e) {
    var elementRect = this.#element.getBoundingClientRect();
    var width = elementRect.right - elementRect.left;
    var height = elementRect.bottom - elementRect.top;

    var x = (1000 * e.velocityX) / width;
    var y = (1000 * e.velocityY) / height;

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
