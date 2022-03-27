import WorkQueue from "./WorkQueue";
import mod from "../util/mod";


class WorkPool {
  #concurrency: any;
  #paused: any;
  #pool: any[];
  #next: number;

  constructor(opts) {
    this.#concurrency = opts && opts.concurrency || 1;
    this.#paused = opts && !!opts.paused || false;

    this.#pool = [];
    for (var i = 0; i < this.#concurrency; i++) {
      this.#pool.push(new WorkQueue(opts));
    }

    this.#next = 0;
  }
  length() {
    var len = 0;
    for (var i = 0; i < this.#pool.length; i++) {
      len += this.#pool[i].length();
    }
    return len;
  }
  push(fn, cb) {
    var i = this.#next;
    var cancel = this.#pool[i].push(fn, cb);
    this.#next = mod(this.#next + 1, this.#concurrency);
    return cancel;
  }
  pause() {
    if (!this.#paused) {
      this.#paused = true;
      for (var i = 0; i < this.#concurrency; i++) {
        this.#pool[i].pause();
      }
    }
  }
  resume() {
    if (this.#paused) {
      this.#paused = false;
      for (var i = 0; i < this.#concurrency; i++) {
        this.#pool[i].resume();
      }
    }
  }
}

export default WorkPool;
