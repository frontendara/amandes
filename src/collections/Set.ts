import mod from "../util/mod";

var defaultCapacity = 64;

// TODO: is this needed? Could we just use js Set
// A set data structure for elements implementing hash() and equals().
// The capacity, if given, is just a hint; the set is allowed to exceed it, but
// performance may suffer.
class Set {
  _capacity: number;
  _buckets: any[];
  _size: number;
  constructor(capacity?: number) {
    if (capacity != null &&
      (!isFinite(capacity) || Math.floor(capacity) !== capacity || capacity < 1)) {
      throw new Error('Set: invalid capacity');
    }
    this._capacity = capacity || defaultCapacity;

    this._buckets = [];
    for (var i = 0; i < this._capacity; i++) {
      this._buckets.push([]);
    }
    this._size = 0;
  }
  // Adds an element, replacing an existing element.
  // Returns the replaced element, or null if no element was replaced.
  add(element) {
    var h = mod(element.hash(), this._capacity);
    var bucket = this._buckets[h];
    for (var i = 0; i < bucket.length; i++) {
      var existingElement = bucket[i];
      if (element.equals(existingElement)) {
        bucket[i] = element;
        return existingElement;
      }
    }
    bucket.push(element);
    this._size++;
    return null;
  }
  // Removes an element.
  // Returns the removed element, or null if the element was not found.
  remove(element) {
    var h = mod(element.hash(), this._capacity);
    var bucket = this._buckets[h];
    for (var i = 0; i < bucket.length; i++) {
      var existingElement = bucket[i];
      if (element.equals(existingElement)) {
        // Splice manually to avoid Array#splice return value allocation.
        for (var j = i; j < bucket.length - 1; j++) {
          bucket[j] = bucket[j + 1];
        }
        bucket.length = bucket.length - 1;
        this._size--;
        return existingElement;
      }
    }
    return null;
  }
  // Returns whether an element is in the set.
  has(element) {
    var h = mod(element.hash(), this._capacity);
    var bucket = this._buckets[h];
    for (var i = 0; i < bucket.length; i++) {
      var existingElement = bucket[i];
      if (element.equals(existingElement)) {
        return true;
      }
    }
    return false;
  }
  // Returns the number of elements in the set.
  size() {
    return this._size;
  }
  // Removes all elements from the set.
  clear() {
    for (var i = 0; i < this._capacity; i++) {
      this._buckets[i].length = 0;
    }
    this._size = 0;
  }
  // Calls fn(element) for each element in the set, in an unspecified order.
  // Returns the number of times fn was called.
  // The result is unspecified if the set is mutated during iteration.
  forEach(fn) {
    var count = 0;
    for (var i = 0; i < this._capacity; i++) {
      var bucket = this._buckets[i];
      for (var j = 0; j < bucket.length; j++) {
        fn(bucket[j]);
        count += 1;
      }
    }
    return count;
  }
}

export default Set;
