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

import Set from "./collections/Set";
import { Tile } from "./jsdoc-extras";

/**
 * A TileSearcher performs searches for visible tiles.
 */
class TileSearcher {
  #stack: any[];
  #visited: Set;
  #vertices: any;

  constructor() {
    // Stack of tiles to be explored.
    this.#stack = [];

    // Set of already explored tiles.
    this.#visited = new Set();

    // Tile vertices. Allocated by Tile#vertices on first use.
    this.#vertices = null;
  }
  /**
   * Performs a search for visible tiles by starting at a given tile and
   * recursively exploring neighbors until no more visible tiles are found.
   *
   * @param {View} view The view used to deem whether a tile is visible.
   * @param tile The starting tile.
   * @param result An array to append the visible tiles to, including the
   *     starting tile when visible. Existing array members are preserved.
   * @return The number of visible tiles found.
   */
  search(view: any, startingTile: Tile, result: Tile[]): number {
    const stack = this.#stack;
    const visited = this.#visited;
    const vertices = this.#vertices;

    let count = 0;

    // Clear internal state.
    this.#clear();

    stack.push(startingTile);

    while (stack.length > 0) {
      const tile = stack.pop();

      if (visited.has(tile)) {
        // Skip already visited tile.
        continue;
      }

      if (!view.intersects(tile.vertices(vertices))) {
        // Skip non-visible tile.
        continue;
      }

      // Mark tile as visited.
      visited.add(tile);

      // Add neighbors to the stack of tiles to explore.
      const neighbors = tile.neighbors();
      for (let i = 0; i < neighbors.length; i++) {
        stack.push(neighbors[i]);
      }

      // Add to result.
      result.push(tile);

      count++;
    }

    // Reuse the vertices array in future searches.
    this.#vertices = vertices;

    // Clear internal state.
    this.#clear();

    return count;
  }
  #clear() {
    this.#stack.length = 0;
    this.#visited.clear();
  }
}

export default TileSearcher;
