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
import WorkQueue from './WorkQueue';
import mod from '../util/mod';

class WorkPool {
  #concurrency: any;
  #paused: any;
  #pool: any[];
  #next: number;

  constructor(opts) {
    this.#concurrency = (opts && opts.concurrency) || 1;
    this.#paused = (opts && !!opts.paused) || false;

    this.#pool = [];
    for (let i = 0; i < this.#concurrency; i++) {
      this.#pool.push(new WorkQueue(opts));
    }

    this.#next = 0;
  }
  length() {
    let len = 0;
    for (let i = 0; i < this.#pool.length; i++) {
      len += this.#pool[i].length();
    }
    return len;
  }
  push(fn, cb) {
    const i = this.#next;
    const cancel = this.#pool[i].push(fn, cb);
    this.#next = mod(this.#next + 1, this.#concurrency);
    return cancel;
  }
  pause() {
    if (!this.#paused) {
      this.#paused = true;
      for (let i = 0; i < this.#concurrency; i++) {
        this.#pool[i].pause();
      }
    }
  }
  resume() {
    if (this.#paused) {
      this.#paused = false;
      for (let i = 0; i < this.#concurrency; i++) {
        this.#pool[i].resume();
      }
    }
  }
}

export default WorkPool;
