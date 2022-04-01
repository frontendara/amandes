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
import Hotspot, { HotspotOptions } from './Hotspot';
import calcRect from './util/calcRect';
import positionAbsolutely from './util/positionAbsolutely';
import {
  setAbsolute,
  setOverflowHidden,
  setOverflowVisible,
  setNullSize,
  setPixelSize,
  setWithVendorPrefix,
} from './util/dom';
import clearOwnProperties from './util/clearOwnProperties';
import { RectilinearViewCoords } from './views/Rectilinear';
import { FlatViewCoords } from './views/Flat';
import { RectSpec } from './jsdoc-extras';

const setPointerEvents = setWithVendorPrefix('pointer-events');

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
  #parentDomElement: any;
  #stage: any;
  #view: any;
  #renderLoop: any;
  #hotspots: Hotspot[];
  #visible: boolean;
  #rect: RectSpec;
  #visibilityOrRectChanged: boolean;
  #stageWidth: null;
  #stageHeight: null;
  #tmpRect: any;
  #hotspotContainerWrapper: HTMLElement;
  #hotspotContainer: HTMLElement;
  #updateHandler: () => void;

  constructor(
    parentDomElement: any,
    stage: any,
    view: any,
    renderLoop: any,
    opts?: { rect?: any } | undefined
  ) {
    opts = opts || {};

    this.#parentDomElement = parentDomElement;
    this.#stage = stage;
    this.#view = view;
    this.#renderLoop = renderLoop;

    // Hotspot list.
    this.#hotspots = [];

    // Whether the hotspot container should be visible.
    this.#visible = true;

    // The current rect.
    this.#rect = opts.rect;

    // Whether the visibility or the rect have changed since the last DOM update.
    this.#visibilityOrRectChanged = true;

    // The last seen stage dimensions.
    this.#stageWidth = null;
    this.#stageHeight = null;

    // Temporary variable to hold the calculated position and size.
    this.#tmpRect = {};

    // Wrapper element. When the rect effect is set, the wrapper will have nonzero
    // dimensions and `pointer-events: none` so that hotspots outside the rect are
    // hidden, but no mouse events are hijacked.
    this.#hotspotContainerWrapper = document.createElement('div');
    setAbsolute(this.#hotspotContainerWrapper);
    setPointerEvents(this.#hotspotContainerWrapper, 'none');
    this.#parentDomElement.appendChild(this.#hotspotContainerWrapper);

    // Hotspot container element. It has zero dimensions and `pointer-events: all`
    // to override the `pointer-events: none` on the wrapper and allow hotspots to
    // be interacted with.
    this.#hotspotContainer = document.createElement('div');
    setAbsolute(this.#hotspotContainer);
    setPointerEvents(this.#hotspotContainer, 'all');
    this.#hotspotContainerWrapper.appendChild(this.#hotspotContainer);

    // Update when the hotspots change or scene is re-rendered.
    this.#updateHandler = this.#update.bind(this);
    this.#renderLoop.addEventListener('afterRender', this.#updateHandler);
  }
  /**
   * Destructor.
   */
  destroy() {
    while (this.#hotspots.length) {
      this.destroyHotspot(this.#hotspots[0]);
    }

    this.#parentDomElement.removeChild(this.#hotspotContainerWrapper);

    this.#renderLoop.removeEventListener('afterRender', this.#updateHandler);

    clearOwnProperties(this);
  }
  domElement() {
    return this.#hotspotContainer;
  }
  setRect(rect: RectSpec) {
    this.#rect = rect;
    this.#visibilityOrRectChanged = true;
  }
  rect() {
    return this.#rect;
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

    const hotspot = new Hotspot(
      domElement,
      this.#hotspotContainer,
      this.#view,
      coords,
      opts
    );
    this.#hotspots.push(hotspot);
    hotspot.update();

    this.emit('hotspotsChange');

    return hotspot;
  }
  emit(_arg0: string) {
    throw new Error('Method not implemented.');
  }
  hasHotspot(hotspot: Hotspot) {
    return this.#hotspots.indexOf(hotspot) >= 0;
  }
  listHotspots() {
    return [...this.#hotspots];
  }
  /**
   * Removes a hotspot from the container.
   */
  destroyHotspot(hotspot: Hotspot) {
    const i = this.#hotspots.indexOf(hotspot);
    if (i < 0) {
      throw new Error('No such hotspot');
    }
    this.#hotspots.splice(i, 1);

    hotspot.destroy();
    this.emit('hotspotsChange');
  }
  /**
   * Hide the container's DOM element, causing every contained {@link Hotspot} to
   * be hidden.
   */
  hide() {
    if (this.#visible) {
      this.#visible = false;
      this.#visibilityOrRectChanged = true;
      this.#update();
    }
  }
  /**
   * Show the container's DOM element, causing every contained {@link Hotspot} to
   * be shown.
   */
  show() {
    if (!this.#visible) {
      this.#visible = true;
      this.#visibilityOrRectChanged = true;
      this.#update();
    }
  }
  #update() {
    const wrapper = this.#hotspotContainerWrapper;
    const width = this.#stage.width();
    const height = this.#stage.height();
    const tmpRect = this.#tmpRect;

    // Avoid updating the wrapper DOM unless necessary.
    if (
      this.#visibilityOrRectChanged ||
      (this.#rect &&
        (width !== this.#stageWidth || height !== this.#stageHeight))
    ) {
      const visible = this.#visible;
      wrapper.style.display = visible ? 'block' : 'none';

      if (visible) {
        if (this.#rect) {
          calcRect(width, height, this.#rect, tmpRect);
          positionAbsolutely(wrapper, width * tmpRect.x, height * tmpRect.y);
          setPixelSize(wrapper, width * tmpRect.width, height * tmpRect.height);
          setOverflowHidden(wrapper);
        } else {
          positionAbsolutely(wrapper, 0, 0);
          setNullSize(wrapper);
          setOverflowVisible(wrapper);
        }
      }

      this.#stageWidth = width;
      this.#stageHeight = height;
      this.#visibilityOrRectChanged = false;
    }

    // Update hotspots unconditionally, as the view parameters may have changed.
    for (let i = 0; i < this.#hotspots.length; i++) {
      this.#hotspots[i].update();
    }
  }
}

eventEmitter(HotspotContainer);

export default HotspotContainer;
