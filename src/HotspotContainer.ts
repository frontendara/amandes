import eventEmitter from "minimal-event-emitter";
import Hotspot, { HotspotOptions } from "./Hotspot";
import calcRect from "./util/calcRect";
import positionAbsolutely from "./util/positionAbsolutely";
import {
  setAbsolute,
  setOverflowHidden,
  setOverflowVisible,
  setNullSize,
  setPixelSize,
  setWithVendorPrefix,
} from "./util/dom";
import clearOwnProperties from "./util/clearOwnProperties";
import { RectilinearViewCoords } from "./views/Rectilinear";
import { FlatViewCoords } from "./views/Flat";
import { RectSpec } from "./jsdoc-extras";

const setPointerEvents = setWithVendorPrefix("pointer-events");

/**
 * Signals that a hotspot has been created or destroyed on the container.
 * @event HotspotContainer#hotspotsChange
 */

/**
 * @class HotspotContainer
 * @classdesc
 *
 * Creates a DOM element to hold {@link Hotspot hotspots} and updates their
 * position when necessary.
 *
 * @param {Element} parentDomElement The DOM element inside which the container
 *     should be created.
 * @param {Stage} stage The underlying stage.
 * @param {View} view The view according to which the hotspots are positioned.
 * @param {RenderLoop} renderLoop The render loop indicating when the hotspots
 *     must be rendered.
 * @param {Object} opts
 * @param {RectSpec} opts.rect Rectangular region covered by the container. See
 *    {@link Effects#rect}.
 */
class HotspotContainer {
  _parentDomElement: any;
  _stage: any;
  _view: any;
  _renderLoop: any;
  _hotspots: Hotspot[];
  _visible: boolean;
  _rect: RectSpec;
  _visibilityOrRectChanged: boolean;
  _stageWidth: null;
  _stageHeight: null;
  _tmpRect: any;
  _hotspotContainerWrapper: HTMLElement;
  _hotspotContainer: HTMLElement;
  _updateHandler: () => void;

  constructor(
    parentDomElement: any,
    stage: any,
    view: any,
    renderLoop: any,
    opts?: { rect?: any } | undefined
  ) {
    opts = opts || {};

    this._parentDomElement = parentDomElement;
    this._stage = stage;
    this._view = view;
    this._renderLoop = renderLoop;

    // Hotspot list.
    this._hotspots = [];

    // Whether the hotspot container should be visible.
    this._visible = true;

    // The current rect.
    this._rect = opts.rect;

    // Whether the visibility or the rect have changed since the last DOM update.
    this._visibilityOrRectChanged = true;

    // The last seen stage dimensions.
    this._stageWidth = null;
    this._stageHeight = null;

    // Temporary variable to hold the calculated position and size.
    this._tmpRect = {};

    // Wrapper element. When the rect effect is set, the wrapper will have nonzero
    // dimensions and `pointer-events: none` so that hotspots outside the rect are
    // hidden, but no mouse events are hijacked.
    this._hotspotContainerWrapper = document.createElement("div");
    setAbsolute(this._hotspotContainerWrapper);
    setPointerEvents(this._hotspotContainerWrapper, "none");
    this._parentDomElement.appendChild(this._hotspotContainerWrapper);

    // Hotspot container element. It has zero dimensions and `pointer-events: all`
    // to override the `pointer-events: none` on the wrapper and allow hotspots to
    // be interacted with.
    this._hotspotContainer = document.createElement("div");
    setAbsolute(this._hotspotContainer);
    setPointerEvents(this._hotspotContainer, "all");
    this._hotspotContainerWrapper.appendChild(this._hotspotContainer);

    // Update when the hotspots change or scene is re-rendered.
    this._updateHandler = this._update.bind(this);
    this._renderLoop.addEventListener("afterRender", this._updateHandler);
  }
  /**
   * Destructor.
   */
  destroy() {
    while (this._hotspots.length) {
      this.destroyHotspot(this._hotspots[0]);
    }

    this._parentDomElement.removeChild(this._hotspotContainerWrapper);

    this._renderLoop.removeEventListener("afterRender", this._updateHandler);

    clearOwnProperties(this);
  }
  domElement() {
    return this._hotspotContainer;
  }
  setRect(rect: RectSpec) {
    this._rect = rect;
    this._visibilityOrRectChanged = true;
  }
  rect() {
    return this._rect;
  }
  /**
   * Creates a new hotspot in this container.
   *
   * @param domElement DOM element to use for the hotspot
   * @param coords The hotspot coordinates.
   *     Use {@link RectilinearViewCoords}` for a {@link RectilinearView} or
   *     {@link FlatViewCoords} for a {@link FlatView}.
   * @param opts Options in the same format as the `opts` argument to
   *     the {@link Hotspot} constructor.
   */
  createHotspot(
    domElement: HTMLElement,
    coords: RectilinearViewCoords | FlatViewCoords,
    opts?: HotspotOptions
  ) {
    coords = coords || {};

    var hotspot = new Hotspot(
      domElement,
      this._hotspotContainer,
      this._view,
      coords,
      opts
    );
    this._hotspots.push(hotspot);
    hotspot._update();

    this.emit("hotspotsChange");

    return hotspot;
  }
  emit(_arg0: string) {
    throw new Error("Method not implemented.");
  }
  hasHotspot(hotspot: Hotspot) {
    return this._hotspots.indexOf(hotspot) >= 0;
  }
  listHotspots() {
    return [...this._hotspots];
  }
  /**
   * Removes a hotspot from the container.
   */
  destroyHotspot(hotspot: Hotspot) {
    var i = this._hotspots.indexOf(hotspot);
    if (i < 0) {
      throw new Error("No such hotspot");
    }
    this._hotspots.splice(i, 1);

    hotspot.destroy();
    this.emit("hotspotsChange");
  }
  /**
   * Hide the container's DOM element, causing every contained {@link Hotspot} to
   * be hidden.
   */
  hide() {
    if (this._visible) {
      this._visible = false;
      this._visibilityOrRectChanged = true;
      this._update();
    }
  }
  /**
   * Show the container's DOM element, causing every contained {@link Hotspot} to
   * be shown.
   */
  show() {
    if (!this._visible) {
      this._visible = true;
      this._visibilityOrRectChanged = true;
      this._update();
    }
  }
  _update() {
    var wrapper = this._hotspotContainerWrapper;
    var width = this._stage.width();
    var height = this._stage.height();
    var tmpRect = this._tmpRect;

    // Avoid updating the wrapper DOM unless necessary.
    if (
      this._visibilityOrRectChanged ||
      (this._rect &&
        (width !== this._stageWidth || height !== this._stageHeight))
    ) {
      var visible = this._visible;
      wrapper.style.display = visible ? "block" : "none";

      if (visible) {
        if (this._rect) {
          calcRect(width, height, this._rect, tmpRect);
          positionAbsolutely(wrapper, width * tmpRect.x, height * tmpRect.y);
          setPixelSize(wrapper, width * tmpRect.width, height * tmpRect.height);
          setOverflowHidden(wrapper);
        } else {
          positionAbsolutely(wrapper, 0, 0);
          setNullSize(wrapper);
          setOverflowVisible(wrapper);
        }
      }

      this._stageWidth = width;
      this._stageHeight = height;
      this._visibilityOrRectChanged = false;
    }

    // Update hotspots unconditionally, as the view parameters may have changed.
    for (var i = 0; i < this._hotspots.length; i++) {
      this._hotspots[i]._update();
    }
  }
}

eventEmitter(HotspotContainer);

export default HotspotContainer;
