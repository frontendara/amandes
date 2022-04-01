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
import WebGlCube from "./WebGlCube";
import WebGlFlat from "./WebGlFlat";
import WebGlEquirect from "./WebGlEquirect";

/**
 * Registers all known renderers for the given stage type into that stage.
 * Most users will not need to register renderers, as {@link Viewer} does it for
 * them.
 *
 * @param {Stage} stage The stage where the renderers are to be registered.
 * @throws An error if the stage type is unknown.
 */
function registerDefaultRenderers(stage) {
  switch (stage.type) {
    case 'webgl':
      stage.registerRenderer('flat', 'flat', WebGlFlat);
      stage.registerRenderer('cube', 'rectilinear', WebGlCube);
      stage.registerRenderer('equirect', 'rectilinear', WebGlEquirect);
      break;
    default:
      throw new Error('Unknown stage type: ' + stage.type);
  }
}

export default registerDefaultRenderers;
