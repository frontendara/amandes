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
import Hammer from "hammerjs";

let nextId = 1;
const idProperty = 'MarzipanoHammerElementId';
function getKeyForElementAndType(element, type) {
  if (!element[idProperty]) {
    element[idProperty] = nextId++;
  }
  return type + element[idProperty];
}


/**
 * Manages Hammer.js instances. One instance is created for each combination of
 * DOM element and pointer type.
 */
class HammerGestures {
  #managers: {};
  #refCount: {};
  constructor() {
    this.#managers = {};
    this.#refCount = {};
  }
  get(element, type) {
    const key = getKeyForElementAndType(element, type);
    if (!this.#managers[key]) {
      this.#managers[key] = this.#createManager(element, type);
      this.#refCount[key] = 0;
    }
    this.#refCount[key]++;
    return new HammerGesturesHandle(this, this.#managers[key], element, type);
  }
  #createManager(element, type) {
    const manager = new Hammer.Manager(element);

    // Managers are created with different parameters for different pointer
    // types.
    if (type === 'mouse') {
      manager.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));
    }
    else if (type === 'touch' || type === 'pen' || type === 'kinect') {
      // On touch one wants to have both panning and pinching. The panning
      // recognizer needs a threshold to allow the pinch to be recognized.
      manager.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 20, pointers: 1 }));
      manager.add(new Hammer.Pinch());
    }

    return manager;
  }
  releaseHandle(element, type) {
    const key = getKeyForElementAndType(element, type);
    if (this.#refCount[key]) {
      this.#refCount[key]--;
      if (!this.#refCount[key]) {
        this.#managers[key].destroy();
        delete this.#managers[key];
        delete this.#refCount[key];
      }
    }
  }
}

export class HammerGesturesHandle {
  #manager: any;
  #element: any;
  #type: any;
  #hammerGestures: any;
  #eventHandlers: any[];

  constructor(hammerGestures, manager, element, type) {
    this.#manager = manager;
    this.#element = element;
    this.#type = type;
    this.#hammerGestures = hammerGestures;
    this.#eventHandlers = [];
  }
  on(events, handler) {
    const type = this.#type;
    const handlerFilteredEvents = function (e) {
      if (type === e.pointerType) {
        handler(e);
      }
    };

    this.#eventHandlers.push({ events: events, handler: handlerFilteredEvents });
    this.#manager.on(events, handlerFilteredEvents);
  }
  release() {
    for (let i = 0; i < this.#eventHandlers.length; i++) {
      const eventHandler = this.#eventHandlers[i];
      this.#manager.off(eventHandler.events, eventHandler.handler);
    }

    this.#hammerGestures.releaseHandle(this.#element, this.#type);
    this.#manager = null;
    this.#element = null;
    this.#type = null;
    this.#hammerGestures = null;
  }
  manager() {
    return this.#manager;
  }
}

export default new HammerGestures();
