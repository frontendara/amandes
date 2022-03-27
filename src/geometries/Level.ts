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