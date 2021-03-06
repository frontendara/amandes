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
import EventEmitter from './EventEmitter.js';

class EventEmitterProxy {
  _object: any;
  _emitter: EventEmitter;
  _listenerArguments: any[];
  constructor(object?: any) {
    this._object = object;
    this._emitter = new EventEmitter();
    this._listenerArguments = [];
  }
  object() {
    return this._object;
  }
  setObject(object) {
    var oldObject = this._object;
    var newObject = object;

    if (oldObject) {
      this._listenerArguments.forEach(function (args) {
        oldObject.removeEventListener.apply(oldObject, args);
      });
    }

    if (newObject) {
      this._listenerArguments.forEach(function (args) {
        newObject.addEventListener.apply(newObject, args);
      });
    }

    this._object = newObject;
    this._emitter.emit('objectChange');
  }
  addEventListener() {
    var ret = null;
    if (this._object) {
      this._object.addEventListener.apply(this._object, arguments);
    }

    this._listenerArguments.push(arguments);

    return ret;
  }
  removeEventListener() {
    var ret = null;
    if (this._object) {
      this._object.removeEventListener.apply(this._object, arguments);
    }

    this._removeFromListenerArguments(arguments);

    return ret;
  }
  addEventListenerProxy() {
    this._emitter.addEventListener.apply(this._emitter, arguments);
  }
  removeEventListenerProxy() {
    this._emitter.removeEventListener.apply(this._emitter, arguments);
  }
  _removeFromListenerArguments(args) {
    for (var i = 0; i < this._listenerArguments.length; i++) {
      var toCompare = this._listenerArguments[i];
      if (toCompare.length === args.length) {
        var equal = true;
        for (var j = 0; j < toCompare.length; j++) {
          if (toCompare[j] !== args[j]) {
            equal = false;
            break;
          }
        }
        if (equal) {
          this._listenerArguments.splice(i, 1);
          i--;
        }
      }
    }
  }
}

export default EventEmitterProxy;
