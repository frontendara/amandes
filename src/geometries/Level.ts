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
// TODO: split this one up into sub types and move to
// corresponding geometries.
export interface LevelProperties {
  // all
  fallbackOnly?: boolean;
  // cube
  size: number;
  tileSize: number;
  // flat
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
}

class Level {
  #fallbackOnly: boolean;
  constructor(levelProperties: LevelProperties) {
    this.#fallbackOnly = !!levelProperties.fallbackOnly;
  }
  numHorizontalTiles() {
    return Math.ceil(this.width() / this.tileWidth());
  }
  width() {
    console.log('not implemented');
    return 0;
  }
  tileWidth() {
    console.log('not implemented');
    return 1;
  }
  numVerticalTiles() {
    return Math.ceil(this.height() / this.tileHeight());
  }
  height() {
    console.log('not implemented');
    return 0;
  }
  tileHeight() {
    console.log('not implemented');
    return 1;
  }
  fallbackOnly() {
    return this.#fallbackOnly;
  }
}

export default Level;