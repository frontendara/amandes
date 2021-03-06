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

// Perform a cancelable delay.
// See util/cancelize.js for an explanation of what cancelables are.
function delay(
  ms: number | undefined,
  done: { (arg0: null): void; apply: (arg0: null, arg1: IArguments) => void }
) {
  // Work around IE8 bug whereby a setTimeout callback may still be called
  // after the corresponding clearTimeout is invoked.
  let timer: any = null;

  function finish() {
    if (timer != null) {
      timer = null;
      done(null);
    }
  }

  function cancel() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
      done.apply(null, arguments);
    }
  }

  timer = setTimeout(finish, ms);

  return cancel;
}

export default delay;
