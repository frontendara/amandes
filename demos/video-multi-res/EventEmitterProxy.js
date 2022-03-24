import EventEmitter from "./EventEmitter.js";

class EventEmitterProxy {
  constructor(object) {
    this._object = object;
    this._emitter = new EventEmitter(this);
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