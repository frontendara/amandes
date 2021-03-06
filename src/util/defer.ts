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

function defer(
  fn: { (): void; apply: (arg0: null, arg1: any) => void },
  args: string | any[]
) {
  function deferred() {
    if (args && args.length > 0) {
      fn.apply(null, args);
    } else {
      fn();
    }
  }
  setTimeout(deferred, 0);
}

export default defer;
