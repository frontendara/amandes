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

// An LruMap holds up to a maximum number of key-value pairs, ordered by their
// time of insertion. When the addition of a key-value pair would cause the
// capacity to be exceeded, the oldest key-value pair in the set is evicted.
// As a special case, an LruMap with zero capacity always rejects the insertion
// of a key-value pair.
//
// Keys must implement hash() and equals(). Note that the implementation doesn't
// currently use hash(), but a future version might.
class LruMap {
  #capacity: any;
  #keys: any[];
  #values: any[];
  #start: number;
  #size: number;

  constructor(capacity) {
    if (
      !isFinite(capacity) ||
      Math.floor(capacity) !== capacity ||
      capacity < 0
    ) {
      throw new Error('LruMap: invalid capacity');
    }
    this.#capacity = capacity;

    // Keys and values are stored in circular arrays ordered by decreasing age.
    // Start is the index of the oldest key/value and size is the number of valid
    // key/values; the region containing valid keys/values may wrap around.
    this.#keys = new Array(this.#capacity);
    this.#values = new Array(this.#capacity);
    this.#start = 0;
    this.#size = 0;
  }
  _index(i) {
    return mod(this.#start + i, this.#capacity);
  }
  // Returns the value associated to the specified key, or null if not found.
  get(key) {
    for (let i = 0; i < this.#size; i++) {
      const existingKey = this.#keys[this._index(i)];
      if (key.equals(existingKey)) {
        return this.#values[this._index(i)];
      }
    }
    return null;
  }
  // Associates the specified value with the specified key, possibly replacing the
  // currently associated value. The key-value pair becomes the newest. If the map
  // is at capacity, the oldest key-value pair is removed. Returns the removed
  // key, or null otherwise. If the capacity is zero, does nothing and returns
  // the key.
  set(key, value) {
    if (this.#capacity === 0) {
      return key;
    }
    this.del(key);
    const evictedKey =
      this.#size === this.#capacity ? this.#keys[this._index(0)] : null;
    this.#keys[this._index(this.#size)] = key;
    this.#values[this._index(this.#size)] = value;
    if (this.#size < this.#capacity) {
      this.#size++;
    } else {
      this.#start = this._index(1);
    }
    return evictedKey;
  }
  // Removes the key-value pair associated with the specified key.
  // Returns the removed value, or null if not found.
  del(key) {
    for (let i = 0; i < this.#size; i++) {
      if (key.equals(this.#keys[this._index(i)])) {
        const existingValue = this.#values[this._index(i)];
        for (let j = i; j < this.#size - 1; j++) {
          this.#keys[this._index(j)] = this.#keys[this._index(j + 1)];
          this.#values[this._index(j)] = this.#values[this._index(j + 1)];
        }
        this.#size--;
        return existingValue;
      }
    }
    return null;
  }
  // Returns whether there is a value associated with the specified key.
  has(key) {
    for (let i = 0; i < this.#size; i++) {
      if (key.equals(this.#keys[this._index(i)])) {
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
    this.#keys.length = 0;
    this.#values.length = 0;
    this.#start = 0;
    this.#size = 0;
  }
  // Calls fn(key, value) for each item in the map, in an unspecified order.
  // Returns the number of times fn was called.
  // The result is unspecified if the map is mutated during iteration.
  forEach(fn) {
    let count = 0;
    for (let i = 0; i < this.#size; i++) {
      fn(this.#keys[this._index(i)], this.#values[this._index(i)]);
      count += 1;
    }
    return count;
  }
}

export default LruMap;
