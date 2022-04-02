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
class EventEmitter {
  __events: any;
  constructor() {}
  addEventListener(event, fn) {
    var eventMap = (this.__events = this.__events || {});
    var handlerList = (eventMap[event] = eventMap[event] || []);
    handlerList.push(fn);
  }
  removeEventListener(event, fn) {
    var eventMap = (this.__events = this.__events || {});
    var handlerList = eventMap[event];
    if (handlerList) {
      var index = handlerList.indexOf(fn);
      if (index >= 0) {
        handlerList.splice(index, 1);
      }
    }
  }
  emit(
    event: string,
    arg1?: any,
    arg2?: any,
    arg3?: any,
    arg4?: any,
    arg5?: any
  ) {
    var eventMap = (this.__events = this.__events || {});
    var handlerList = eventMap[event];
    if (handlerList) {
      for (var i = 0; i < handlerList.length; i++) {
        var fn = handlerList[i];
        fn.call(this, arg1, arg2, arg3, arg4, arg5);
      }
    }
  }
}

export default EventEmitter;
