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
import mod from '../util/mod';

// An LruSet holds up to a maximum number of elements, ordered by their time of
// insertion. When the addition of an element would cause the capacity to be
// exceeded, the oldest element in the set is evicted. As a special case, an
// LruSet with zero capacity always rejects the insertion of an element.
//
// Elements must implement hash() and equals(). Note that the implementation
// doesn't currently use hash(), but a future version might.
class LruSet {
  #capacity: any;
  #elements: any[];
  #start: number;
  #size: number;

  constructor(capacity) {
    if (
      !isFinite(capacity) ||
      Math.floor(capacity) !== capacity ||
      capacity < 0
    ) {
      throw new Error('LruSet: invalid capacity');
    }
    this.#capacity = capacity;

    // Elements are stored in a circular array ordered by decreasing age.
    // Start is the index of the oldest element and size is the number of valid
    // elements; the region containing valid elements may wrap around.
    this.#elements = new Array(this.#capacity);
    this.#start = 0;
    this.#size = 0;
  }
  #index(i) {
    return mod(this.#start + i, this.#capacity);
  }
  // Adds an element into the set, possibly replacing an equal element already in
  // the set. The element becomes the newest. If the set is at capacity, the
  // oldest element is removed. Returns the removed element if it does not equal
  // the inserted element, or null otherwise. If the capacity is zero, does
  // nothing and returns the element.
  add(element) {
    if (this.#capacity === 0) {
      return element;
    }
    this.remove(element);
    const evictedElement =
      this.#size === this.#capacity ? this.#elements[this.#index(0)] : null;
    this.#elements[this.#index(this.#size)] = element;
    if (this.#size < this.#capacity) {
      this.#size++;
    } else {
      this.#start = this.#index(1);
    }
    return evictedElement;
  }
  // Removes an element from the set.
  // Returns the removed element, or null if the element was not found.
  remove(element) {
    for (let i = 0; i < this.#size; i++) {
      const existingElement = this.#elements[this.#index(i)];
      if (element.equals(existingElement)) {
        for (let j = i; j < this.#size - 1; j++) {
          this.#elements[this.#index(j)] = this.#elements[this.#index(j + 1)];
        }
        this.#size--;
        return existingElement;
      }
    }
    return null;
  }
  // Returns whether an element is in the set.
  has(element) {
    for (let i = 0; i < this.#size; i++) {
      if (element.equals(this.#elements[this.#index(i)])) {
        return true;
      }
    }
    return false;
  }
  // Returns the number of elements in the set.
  size() {
    return this.#size;
  }
  // Removes all elements from the set.
  clear() {
    this.#elements.length = 0;
    this.#start = 0;
    this.#size = 0;
  }
  // Calls fn(element) for each element in the set, in an unspecified order.
  // Returns the number of times fn was called.
  // The result is unspecified if the set is mutated during iteration.
  forEach(fn) {
    let count = 0;
    for (let i = 0; i < this.#size; i++) {
      fn(this.#elements[this.#index(i)]);
      count += 1;
    }
    return count;
  }
}

export default LruSet;
