import WorkQueue from "./WorkQueue";
import mod from "../util/mod";


class WorkPool {
  _concurrency: any;
  _paused: any;
  _pool: any[];
  _next: number;

  constructor(opts) {
    this._concurrency = opts && opts.concurrency || 1;
    this._paused = opts && !!opts.paused || false;

    this._pool = [];
    for (var i = 0; i < this._concurrency; i++) {
      this._pool.push(new WorkQueue(opts));
    }

    this._next = 0;
  }
  length() {
    var len = 0;
    for (var i = 0; i < this._pool.length; i++) {
      len += this._pool[i].length();
    }
    return len;
  }
  push(fn, cb) {
    var i = this._next;
    var cancel = this._pool[i].push(fn, cb);
    this._next = mod(this._next + 1, this._concurrency);
    return cancel;
  }
  pause() {
    if (!this._paused) {
      this._paused = true;
      for (var i = 0; i < this._concurrency; i++) {
        this._pool[i].pause();
      }
    }
  }
  resume() {
    if (this._paused) {
      this._paused = false;
      for (var i = 0; i < this._concurrency; i++) {
        this._pool[i].resume();
      }
    }
  }
}

export default WorkPool;
