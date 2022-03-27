import now from '../util/now';

class WorkTask {
  fn: any;
  cb: any;
  cfn: null;

  constructor(fn, cb) {
    this.fn = fn;
    this.cb = cb;
    this.cfn = null;
  }
}

class WorkQueue {
  #queue: any[];
  #delay: any;
  #paused: any;
  #currentTask: null;
  #lastFinished: null | number;
  constructor(opts) {
    this.#queue = [];
    this.#delay = opts && opts.delay || 0;
    this.#paused = opts && !!opts.paused || false;
    this.#currentTask = null;
    this.#lastFinished = null;
  }
  length() {
    return this.#queue.length;
  }
  push(fn, cb) {

    var task = new WorkTask(fn, cb);

    var cancel = this.#cancel.bind(this, task);

    // Push the task into the queue.
    this.#queue.push(task);

    // Run the task if idle.
    this.#next();

    return cancel;

  }
  pause() {
    if (!this.#paused) {
      this.#paused = true;
    }
  }
  resume() {
    if (this.#paused) {
      this.#paused = false;
      this.#next();
    }
  }
  #start(task) {

    // Consistency check.
    if (this.#currentTask) {
      throw new Error('WorkQueue: called start while running task');
    }

    // Mark queue as busy, so that concurrent tasks wait.
    this.#currentTask = task;

    // Execute the task.
    var finish = this.#finish.bind(this, task);
    task.cfn = task.fn(finish);

    // Detect when a non-cancellable function has been queued.
    if (typeof task.cfn !== 'function') {
      throw new Error('WorkQueue: function is not cancellable');
    }

  }
  #finish(task) {

    var args = Array.prototype.slice.call(arguments, 1);

    // Consistency check.
    if (this.#currentTask !== task) {
      throw new Error('WorkQueue: called finish on wrong task');
    }

    // Call the task callback on the return values.
    task.cb.apply(null, args);

    // Mark as not busy and record task finish time, then advance to next task.
    this.#currentTask = null;
    this.#lastFinished = now();
    this.#next();

  }
  #cancel(task) {

    var args = Array.prototype.slice.call(arguments, 1);

    if (this.#currentTask === task) {

      // Cancel running task. Because cancel passes control to the #finish
      // callback we passed into fn, the cleanup logic will be handled there.
      task.cfn.apply(null, args);

    } else {

      // Remove task from queue.
      var pos = this.#queue.indexOf(task);
      if (pos >= 0) {
        this.#queue.splice(pos, 1);
        task.cb.apply(null, args);
      }

    }

  }
  #next() {

    if (this.#paused) {
      // Do not start tasks while paused.
      return;
    }

    if (!this.#queue.length) {
      // No tasks to run.
      return;
    }

    if (this.#currentTask) {
      // Will be called again when the current task finishes.
      return;
    }

    if (this.#lastFinished != null) {
      var elapsed = now() - this.#lastFinished;
      var remaining = this.#delay - elapsed;
      if (remaining > 0) {
        // Too soon. Run again after the inter-task delay.
        setTimeout(this.#next.bind(this), remaining);
        return;
      }
    }

    // Run the next task.
    var task = this.#queue.shift();
    this.#start(task);

  }
}

export default WorkQueue;
