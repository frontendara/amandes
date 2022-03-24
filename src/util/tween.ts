import now from "./now";

function tween(duration: number, update: (arg0: number) => void, done: { (): void; apply: (arg0: null, arg1: IArguments) => void; }) {
  var cancelled = false;

  var startTime = now();

  function runUpdate() {
    if(cancelled) { return; }
    var tweenVal = (now() - startTime)/duration;
    if(tweenVal < 1) {
      update(tweenVal);
      requestAnimationFrame(runUpdate);
    }
    else {
      update(1);
      done();
    }
  }

  update(0);
  requestAnimationFrame(runUpdate);

  return function cancel() {
    cancelled = true;
    done.apply(null, arguments);
  }
}

export default tween;