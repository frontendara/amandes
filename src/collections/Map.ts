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
import mod from "../util/mod";

const defaultCapacity = 64;

// A map data structure for keys implementing hash() and equals() and arbitrary
// values. The capacity, if given, is just a hint; the map is allowed to exceed
// it, but performance may suffer.
class Map {
  #capacity: any;
  #keyBuckets: any[];
  #valBuckets: any[];
  #size: number;
  constructor(capacity?: number) {
    if (capacity != null &&
      (!isFinite(capacity) || Math.floor(capacity) !== capacity || capacity < 1)) {
      throw new Error('Map: invalid capacity');
    }
    this.#capacity = capacity || defaultCapacity;

    this.#keyBuckets = [];
    this.#valBuckets = [];
    for (let i = 0; i < this.#capacity; i++) {
      this.#keyBuckets.push([]);
      this.#valBuckets.push([]);
    }
    this.#size = 0;
  }
  // Returns the value associated with the specified key, or null if not found.
  get(key) {
    const h = mod(key.hash(), this.#capacity);
    const keyBucket = this.#keyBuckets[h];
    for (let i = 0; i < keyBucket.length; i++) {
      const existingKey = keyBucket[i];
      if (key.equals(existingKey)) {
        const valBucket = this.#valBuckets[h];
        const existingValue = valBucket[i];
        return existingValue;
      }
    }
    return null;
  }
  // Associates the specified value with the specified key, possibly replacing the
  // currently associated value.
  // Returns the replaced value, or null if no value was replaced.
  set(key, val) {
    const h = mod(key.hash(), this.#capacity);
    const keyBucket = this.#keyBuckets[h];
    const valBucket = this.#valBuckets[h];
    for (let i = 0; i < keyBucket.length; i++) {
      const existingKey = keyBucket[i];
      if (key.equals(existingKey)) {
        const existingValue = valBucket[i];
        keyBucket[i] = key;
        valBucket[i] = val;
        return existingValue;
      }
    }
    keyBucket.push(key);
    valBucket.push(val);
    this.#size++;
    return null;
  }
  // Removes the key-value pair associated with the specified key.
  // Returns the removed value, or null if not found.
  del(key) {
    const h = mod(key.hash(), this.#capacity);
    const keyBucket = this.#keyBuckets[h];
    const valBucket = this.#valBuckets[h];
    for (let i = 0; i < keyBucket.length; i++) {
      const existingKey = keyBucket[i];
      if (key.equals(existingKey)) {
        const existingValue = valBucket[i];
        // Splice manually to avoid Array#splice return value allocation.
        for (let j = i; j < keyBucket.length - 1; j++) {
          keyBucket[j] = keyBucket[j + 1];
          valBucket[j] = valBucket[j + 1];
        }
        keyBucket.length = keyBucket.length - 1;
        valBucket.length = valBucket.length - 1;
        this.#size--;
        return existingValue;
      }
    }
    return null;
  }
  // Returns whether there is a value associated with the specified key.
  has(key) {
    const h = mod(key.hash(), this.#capacity);
    const keyBucket = this.#keyBuckets[h];
    for (let i = 0; i < keyBucket.length; i++) {
      const existingKey = keyBucket[i];
      if (key.equals(existingKey)) {
        return true;
      }
    }
    return false;
  }
  // Returns the number of key-value pairs in the map.
  size() {
    return this.#size;
  }
  // Removes all key-value pairs from the map.
  clear() {
    for (let i = 0; i < this.#capacity; i++) {
      this.#keyBuckets[i].length = 0;
      this.#valBuckets[i].length = 0;
    }
    this.#size = 0;
  }
  // Calls fn(key, value) for each key-value pair in the map, in an unspecified
  // order. Returns the number of times fn was called.
  // The result is unspecified if the map is mutated during iteration.
  forEach(fn) {
    let count = 0;
    for (let i = 0; i < this.#capacity; i++) {
      const keyBucket = this.#keyBuckets[i];
      const valBucket = this.#valBuckets[i];
      for (let j = 0; j < keyBucket.length; j++) {
        fn(keyBucket[j], valBucket[j]);
        count += 1;
      }
    }
    return count;
  }
}

export default Map;
