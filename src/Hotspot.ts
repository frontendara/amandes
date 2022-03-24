import eventEmitter from "minimal-event-emitter";
import positionAbsolutely from "./util/positionAbsolutely";
import { setTransform as setTransform } from "./util/dom";
import clearOwnProperties from "./util/clearOwnProperties";
import { RectilinearViewCoords } from "./views/Rectilinear";
import { FlatViewCoords } from "./views/Flat";

export interface Perspective {
    radius: number | null;
    extraTransforms?: string;
}
export interface HotspotOptions {
  perspective?: Perspective;
}

export type HotspotCoords = RectilinearViewCoords | FlatViewCoords;

/**
 * @class Hotspot
 * @classdesc
 *
 * A Hotspot allows a DOM element to be placed at a fixed position in the
 * image. The position is updated automatically when the {@link View view}
 * changes.
 *
 * Positioning is performed with the `transform` CSS property when available,
 * falling back to the `position`, `left` and `top` properties when not.
 * In both cases, the top left corner of the element is placed in the requested
 * position; clients are expected to use additional children elements or other
 * CSS properties to achieve more sophisticated layouts.
 *
 * There are two kinds of hotspots: regular and embedded. A regular hotspot
 * does not change size depending on the zoom level. An embedded hotspot is
 * displayed at a fixed size relative to the panorama, always covering the
 * same portion of the image.
 *
 * Clients should call {@link HotspotContainer#createHotspot} instead of
 * invoking the constructor directly.
 *
 * @param domElement The DOM element.
 * @param parentDomElement The DOM element.
 * @param {View} view The view.
 * @param coords The hotspot coordinates.
 *     Use {@link RectilinearViewCoords} for a {@link RectilinearView} or
 *     {@link FlatViewCoords} for a {@link FlatView}.
 * @param {Object} opts Additional options.
 * @param {Object} opts.perspective Perspective options for embedded hotspots.
 * @param {number} [opts.perspective.radius=null] If set, embed the hotspot
 *     into the image by transforming it into the surface of a sphere with this
 *     radius.
 * @param {string} [opts.perspective.extraTransforms=null] If set, append this
 *     value to the CSS `transform` property used to position the hotspot. This
 *     may be used to rotate an embedded hotspot.
 */
class Hotspot {
  _domElement: HTMLElement;
  _parentDomElement: HTMLElement;
  _view: any;
  _coords: HotspotCoords;
  _perspective: Perspective;
  _visible: boolean;
  _position: { x: number; y: number };

  constructor(
    domElement: HTMLElement,
    parentDomElement: HTMLElement,
    view,
    coords: HotspotCoords,
    opts?: HotspotOptions
  ) {
    opts = opts || {} as HotspotOptions;
    opts.perspective = opts.perspective || {} as Perspective;
    // TODO: fix this ignore madness
    // @ts-ignore
    opts.perspective.extraTransforms =
    // @ts-ignore
      opts.perspective.extraTransforms != null
    // @ts-ignore
        ? opts.perspective.extraTransforms
        : "";

    this._domElement = domElement;
    this._parentDomElement = parentDomElement;
    this._view = view;
    // TODO: remove this casting
    this._coords = {} as HotspotCoords;
    this._perspective = {} as Perspective;

    this.setPosition(coords);

    // Add hotspot into the DOM.
    this._parentDomElement.appendChild(this._domElement);

    this.setPerspective(opts.perspective);

    // Whether the hotspot is visible.
    // The hotspot may still be hidden if it's inside a hidden HotspotContainer.
    this._visible = true;

    // The current calculated screen position.
    this._position = { x: 0, y: 0 };
  }
  /**
   * Destructor.
   * Clients should call {@link HotspotContainer#destroyHotspot} instead.
   */
  destroy() {
    this._parentDomElement.removeChild(this._domElement);
    clearOwnProperties(this);
  }
  domElement() {
    return this._domElement;
  }
  position() {
    return this._coords;
  }
  setPosition(coords: HotspotCoords) {
    for (var key in coords) {
      this._coords[key] = coords[key];
    }
    this._update();
    // TODO: We should probably emit a hotspotsChange event on the parent
    // HotspotContainer. What's the best way to do so?
  }
  perspective() {
    return this._perspective;
  }
  setPerspective(perspective: Perspective) {
    for (var key in perspective) {
      this._perspective[key] = perspective[key];
    }
    this._update();
  }
  /**
   * Show the hotspot
   */
  show() {
    if (!this._visible) {
      this._visible = true;
      this._update();
    }
  }
  /**
   * Hide the hotspot
   */
  hide() {
    if (this._visible) {
      this._visible = false;
      this._update();
    }
  }
  _update() {
    var element = this._domElement;

    var params = this._coords;
    var position = this._position;
    var x, y;

    var isVisible = false;

    if (this._visible) {
      var view = this._view;

      if (this._perspective.radius) {
        // Hotspots that are embedded in the panorama may be visible even when
        // positioned behind the camera.
        isVisible = true;
        this._setEmbeddedPosition(view, params);
      } else {
        // Regular hotspots are only visible when positioned in front of the
        // camera. Note that they may be partially visible when positioned outside
        // the viewport.
        view.coordinatesToScreen(params, position);
        x = position.x;
        y = position.y;

        if (x != null && y != null) {
          isVisible = true;
          this._setPosition(x, y);
        }
      }
    }

    // Show if visible, hide if not.
    if (isVisible) {
      element.style.display = "block";
      element.style.position = "absolute";
    } else {
      element.style.display = "none";
      element.style.position = "";
    }
  }
  _setEmbeddedPosition(view: { coordinatesToPerspectiveTransform: (arg0: any, arg1: number | null, arg2: string | undefined) => any; }, params: HotspotCoords) {
    var transform = view.coordinatesToPerspectiveTransform(
      params,
      this._perspective.radius,
      this._perspective.extraTransforms
    );
    setTransform(this._domElement, transform);
  }
  _setPosition(x: number, y: number) {
    positionAbsolutely(
      this._domElement,
      x,
      y,
      this._perspective.extraTransforms
    );
  }
}

eventEmitter(Hotspot);

export default Hotspot;
