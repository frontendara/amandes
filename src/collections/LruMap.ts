import mod from "../util/mod";

// An LruMap holds up to a maximum number of key-value pairs, ordered by their
// time of insertion. When the addition of a key-value pair would cause the
// capacity to be exceeded, the oldest key-value pair in the set is evicted.
// As a special case, an LruMap with zero capacity always rejects the insertion
// of a key-value pair.
//
// Keys must implement hash() and equals(). Note that the implementation doesn't
// currently use hash(), but a future version might.
class LruMap {
  _capacity: any;
  _keys: any[];
  _values: any[];
  _start: number;
  _size: number;

  constructor(capacity) {
    if (!isFinite(capacity) || Math.floor(capacity) !== capacity || capacity < 0) {
      throw new Error('LruMap: invalid capacity');
    }
    this._capacity = capacity;

    // Keys and values are stored in circular arrays ordered by decreasing age.
    // Start is the index of the oldest key/value and size is the number of valid
    // key/values; the region containing valid keys/values may wrap around.
    this._keys = new Array(this._capacity);
    this._values = new Array(this._capacity);
    this._start = 0;
    this._size = 0;
  }
  _index(i) {
    return mod(this._start + i, this._capacity);
  }
  // Returns the value associated to the specified key, or null if not found.
  get(key) {
    for (var i = 0; i < this._size; i++) {
      var existingKey = this._keys[this._index(i)];
      if (key.equals(existingKey)) {
        return this._values[this._index(i)];
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
    if (this._capacity === 0) {
      return key;
    }
    this.del(key);
    var evictedKey = this._size === this._capacity ? this._keys[this._index(0)] : null;
    this._keys[this._index(this._size)] = key;
    this._values[this._index(this._size)] = value;
    if (this._size < this._capacity) {
      this._size++;
    } else {
      this._start = this._index(1);
    }
    return evictedKey;
  }
  // Removes the key-value pair associated with the specified key.
  // Returns the removed value, or null if not found.
  del(key) {
    for (var i = 0; i < this._size; i++) {
      if (key.equals(this._keys[this._index(i)])) {
        var existingValue = this._values[this._index(i)];
        for (var j = i; j < this._size - 1; j++) {
          this._keys[this._index(j)] = this._keys[this._index(j + 1)];
          this._values[this._index(j)] = this._values[this._index(j + 1)];
        }
        this._size--;
        return existingValue;
      }
    }
    return null;
  }
  // Returns whether there is a value associated with the specified key.
  has(key) {
    for (var i = 0; i < this._size; i++) {
      if (key.equals(this._keys[this._index(i)])) {
        return true;
      }
    }
    return false;
  }
  // Returns the number of key-value pairs in the map.
  size() {
    return this._size;
  }
  // Removes all key-value pairs from the map.
  clear() {
    this._keys.length = 0;
    this._values.length = 0;
    this._start = 0;
    this._size = 0;
  }
  // Calls fn(key, value) for each item in the map, in an unspecified order.
  // Returns the number of times fn was called.
  // The result is unspecified if the map is mutated during iteration.
  forEach(fn) {
    var count = 0;
    for (var i = 0; i < this._size; i++) {
      fn(this._keys[this._index(i)], this._values[this._index(i)]);
      count += 1;
    }
    return count;
  }
}

export default LruMap;
