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

const defaultCapacity = 64;

// TODO: is this needed? Could we just use js Set
// A set data structure for elements implementing hash() and equals().
// The capacity, if given, is just a hint; the set is allowed to exceed it, but
// performance may suffer.
class Set {
  #capacity: number;
  #buckets: any[];
  #size: number;
  constructor(capacity?: number) {
    if (
      capacity != null &&
      (!isFinite(capacity) || Math.floor(capacity) !== capacity || capacity < 1)
    ) {
      throw new Error('Set: invalid capacity');
    }
    this.#capacity = capacity || defaultCapacity;

    this.#buckets = [];
    for (let i = 0; i < this.#capacity; i++) {
      this.#buckets.push([]);
    }
    this.#size = 0;
  }
  // Adds an element, replacing an existing element.
  // Returns the replaced element, or null if no element was replaced.
  add(element) {
    const h = mod(element.hash(), this.#capacity);
    const bucket = this.#buckets[h];
    for (let i = 0; i < bucket.length; i++) {
      const existingElement = bucket[i];
      if (element.equals(existingElement)) {
        bucket[i] = element;
        return existingElement;
      }
    }
    bucket.push(element);
    this.#size++;
    return null;
  }
  // Removes an element.
  // Returns the removed element, or null if the element was not found.
  remove(element) {
    const h = mod(element.hash(), this.#capacity);
    const bucket = this.#buckets[h];
    for (let i = 0; i < bucket.length; i++) {
      const existingElement = bucket[i];
      if (element.equals(existingElement)) {
        // Splice manually to avoid Array#splice return value allocation.
        for (let j = i; j < bucket.length - 1; j++) {
          bucket[j] = bucket[j + 1];
        }
        bucket.length = bucket.length - 1;
        this.#size--;
        return existingElement;
      }
    }
    return null;
  }
  // Returns whether an element is in the set.
  has(element) {
    const h = mod(element.hash(), this.#capacity);
    const bucket = this.#buckets[h];
    for (let i = 0; i < bucket.length; i++) {
      const existingElement = bucket[i];
      if (element.equals(existingElement)) {
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
    for (let i = 0; i < this.#capacity; i++) {
      this.#buckets[i].length = 0;
    }
    this.#size = 0;
  }
  // Calls fn(element) for each element in the set, in an unspecified order.
  // Returns the number of times fn was called.
  // The result is unspecified if the set is mutated during iteration.
  forEach(fn) {
    let count = 0;
    for (let i = 0; i < this.#capacity; i++) {
      const bucket = this.#buckets[i];
      for (let j = 0; j < bucket.length; j++) {
        fn(bucket[j]);
        count += 1;
      }
    }
    return count;
  }
}

export default Set;
