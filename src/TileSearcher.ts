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
    var stack = this.#stack;
    var visited = this.#visited;
    var vertices = this.#vertices;

    var count = 0;

    // Clear internal state.
    this.#clear();

    stack.push(startingTile);

    while (stack.length > 0) {
      var tile = stack.pop();

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
      var neighbors = tile.neighbors();
      for (var i = 0; i < neighbors.length; i++) {
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
