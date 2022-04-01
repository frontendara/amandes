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
import hash from '../util/hash';
import TileSearcher from '../TileSearcher';
import LruMap from '../collections/LruMap';
import Level from './Level';
import { makeLevelList as makeLevelList } from './common';
import { makeSelectableLevelList as makeSelectableLevelList } from './common';
import clamp from '../util/clamp';
import cmp from '../util/cmp';
import getType from '../util/type';
import { vec3 as vec3 } from 'gl-matrix';
import { vec4 as vec4 } from 'gl-matrix';
import { Size, Tile } from '../jsdoc-extras';

var neighborsCacheSize = 64;

// Initials for cube faces.
var faceList = 'fudlrb';

// Rotation of each face, relative to the front face.
var faceRotation = {
  f: { x: 0, y: 0 },
  b: { x: 0, y: Math.PI },
  l: { x: 0, y: Math.PI / 2 },
  r: { x: 0, y: -Math.PI / 2 },
  u: { x: Math.PI / 2, y: 0 },
  d: { x: -Math.PI / 2, y: 0 },
};

// Zero vector.
var origin = vec3.create();

// Rotate a vector in ZXY order.
function rotateVector(vec, z, x, y) {
  if (z) {
    vec3.rotateZ(vec, vec, origin, z);
  }
  if (x) {
    vec3.rotateX(vec, vec, origin, x);
  }
  if (y) {
    vec3.rotateY(vec, vec, origin, y);
  }
}

// Normalized vectors pointing to the center of each face.
var faceVectors = {};
for (var i = 0; i < faceList.length; i++) {
  var face = faceList[i];
  var rotation = faceRotation[face];
  var v = vec3.fromValues(0, 0, -1);
  rotateVector(v, 0, rotation.x, rotation.y);
  faceVectors[face] = v;
}

// Map each face to its adjacent faces.
// The order is as suggested by the front face.
var adjacentFace = {
  f: ['l', 'r', 'u', 'd'],
  b: ['r', 'l', 'u', 'd'],
  l: ['b', 'f', 'u', 'd'],
  r: ['f', 'b', 'u', 'd'],
  u: ['l', 'r', 'b', 'f'],
  d: ['l', 'r', 'f', 'b'],
};

// Offsets to apply to the (x,y) coordinates of a tile to get its neighbors.
var neighborOffsets = [
  [0, 1], // top
  [1, 0], // right
  [0, -1], // bottom
  [-1, 0], // left
];

/**
 * @class CubeTile
 * @implements Tile
 * @classdesc
 *
 * A tile in a @{CubeGeometry}.
 */
class CubeTile {
  face: any;
  x: any;
  y: any;
  z: any;
  _geometry: any;
  _level: any;
  type = 'cube' as const;
  constructor(face, x, y, z, geometry) {
    this.face = face;
    this.x = x;
    this.y = y;
    this.z = z;
    this._geometry = geometry;
    this._level = geometry.levelList[z];
  }
  rotX() {
    return faceRotation[this.face].x;
  }
  rotY() {
    return faceRotation[this.face].y;
  }
  centerX() {
    return (this.x + 0.5) / this._level.numHorizontalTiles() - 0.5;
  }
  centerY() {
    return 0.5 - (this.y + 0.5) / this._level.numVerticalTiles();
  }
  scaleX() {
    return 1 / this._level.numHorizontalTiles();
  }
  scaleY() {
    return 1 / this._level.numVerticalTiles();
  }
  vertices(result) {
    if (!result) {
      result = [vec3.create(), vec3.create(), vec3.create(), vec3.create()];
    }

    var rot = faceRotation[this.face];

    function makeVertex(vec, x, y) {
      vec3.set(vec, x, y, -0.5);
      rotateVector(vec, 0, rot.x, rot.y);
    }

    var left = this.centerX() - this.scaleX() / 2;
    var right = this.centerX() + this.scaleX() / 2;
    var bottom = this.centerY() - this.scaleY() / 2;
    var top = this.centerY() + this.scaleY() / 2;

    makeVertex(result[0], left, top);
    makeVertex(result[1], right, top);
    makeVertex(result[2], right, bottom);
    makeVertex(result[3], left, bottom);

    return result;
  }
  parent() {
    if (this.z === 0) {
      return null;
    }

    var face = this.face;
    var z = this.z;
    var x = this.x;
    var y = this.y;

    var geometry = this._geometry;
    var level = geometry.levelList[z];
    var parentLevel = geometry.levelList[z - 1];

    var tileX = Math.floor(
      (x / level.numHorizontalTiles()) * parentLevel.numHorizontalTiles()
    );
    var tileY = Math.floor(
      (y / level.numVerticalTiles()) * parentLevel.numVerticalTiles()
    );
    var tileZ = z - 1;

    return new CubeTile(face, tileX, tileY, tileZ, geometry);
  }
  children(result) {
    if (this.z === this._geometry.levelList.length - 1) {
      return null;
    }

    var face = this.face;
    var z = this.z;
    var x = this.x;
    var y = this.y;

    var geometry = this._geometry;
    var level = geometry.levelList[z];
    var childLevel = geometry.levelList[z + 1];

    var nHoriz = childLevel.numHorizontalTiles() / level.numHorizontalTiles();
    var nVert = childLevel.numVerticalTiles() / level.numVerticalTiles();

    result = result || [];

    for (var h = 0; h < nHoriz; h++) {
      for (var v = 0; v < nVert; v++) {
        var tileX = nHoriz * x + h;
        var tileY = nVert * y + v;
        var tileZ = z + 1;
        result.push(new CubeTile(face, tileX, tileY, tileZ, geometry));
      }
    }

    return result;
  }
  neighbors() {
    var geometry = this._geometry;
    var cache = geometry._neighborsCache;

    // Satisfy from cache when available.
    var cachedResult = cache.get(this);
    if (cachedResult) {
      return cachedResult;
    }

    var vec = geometry._vec;

    var face = this.face;
    var x = this.x;
    var y = this.y;
    var z = this.z;
    var level = this._level;

    var numX = level.numHorizontalTiles();
    var numY = level.numVerticalTiles();

    var result: Tile[] = [];

    for (var i = 0; i < neighborOffsets.length; i++) {
      var xOffset = neighborOffsets[i][0];
      var yOffset = neighborOffsets[i][1];

      var newX = x + xOffset;
      var newY = y + yOffset;
      var newZ = z;
      var newFace = face;

      if (newX < 0 || newX >= numX || newY < 0 || newY >= numY) {
        // If the neighboring tile belongs to a different face, calculate a
        // vector pointing to the edge between the two faces at the point the
        // tile and its neighbor meet, and convert it into tile coordinates for
        // the neighboring face.
        var xCoord = this.centerX();
        var yCoord = this.centerY();

        // First, calculate the vector as if the initial tile belongs to the
        // front face, so that the tile x,y coordinates map directly into the
        // x,y axes.
        if (newX < 0) {
          vec3.set(vec, -0.5, yCoord, -0.5);
          newFace = adjacentFace[face][0];
        } else if (newX >= numX) {
          vec3.set(vec, 0.5, yCoord, -0.5);
          newFace = adjacentFace[face][1];
        } else if (newY < 0) {
          vec3.set(vec, xCoord, 0.5, -0.5);
          newFace = adjacentFace[face][2];
        } else if (newY >= numY) {
          vec3.set(vec, xCoord, -0.5, -0.5);
          newFace = adjacentFace[face][3];
        }

        var rot;

        // Then, rotate the vector into the actual face the initial tile
        // belongs to.
        rot = faceRotation[face];
        rotateVector(vec, 0, rot.x, rot.y);

        // Finally, rotate the vector from the neighboring face into the front
        // face. Again, this is so that the neighboring tile x,y coordinates
        // map directly into the x,y axes.
        rot = faceRotation[newFace];
        rotateVector(vec, 0, -rot.x, -rot.y);

        // Calculate the neighboring tile coordinates.
        newX = clamp(Math.floor((0.5 + vec[0]) * numX), 0, numX - 1);
        newY = clamp(Math.floor((0.5 - vec[1]) * numY), 0, numY - 1);
      }

      result.push(new CubeTile(newFace, newX, newY, newZ, geometry));
    }

    // Store into cache to satisfy future requests.
    cache.set(this, result);

    return result;
  }
  hash() {
    return hash(faceList.indexOf(this.face), this.z, this.y, this.x);
  }
  equals(that) {
    return (
      this._geometry === that._geometry &&
      this.face === that.face &&
      this.z === that.z &&
      this.y === that.y &&
      this.x === that.x
    );
  }
  cmp(that) {
    return (
      cmp(this.z, that.z) ||
      cmp(faceList.indexOf(this.face), faceList.indexOf(that.face)) ||
      cmp(this.y, that.y) ||
      cmp(this.x, that.x)
    );
  }
  str() {
    return (
      'CubeTile(' +
      this.face +
      ', ' +
      this.x +
      ', ' +
      this.y +
      ', ' +
      this.z +
      ')'
    );
  }
}

class CubeLevel extends Level {
  _size: any;
  _tileSize: any;
  constructor(levelProperties) {
    super(levelProperties);

    this._size = levelProperties.size;
    this._tileSize = levelProperties.tileSize;

    if (this._size % this._tileSize !== 0) {
      throw new Error(
        'Level size is not multiple of tile size: ' +
          this._size +
          ' ' +
          this._tileSize
      );
    }
  }
  width() {
    return this._size;
  }
  height() {
    return this._size;
  }
  tileWidth() {
    return this._tileSize;
  }
  tileHeight() {
    return this._tileSize;
  }
  _validateWithParentLevel(parentLevel) {
    var width = this.width();
    var height = this.height();
    var tileWidth = this.tileWidth();
    var tileHeight = this.tileHeight();
    var numHorizontal = this.numHorizontalTiles();
    var numVertical = this.numVerticalTiles();

    var parentWidth = parentLevel.width();
    var parentHeight = parentLevel.height();
    var parentTileWidth = parentLevel.tileWidth();
    var parentTileHeight = parentLevel.tileHeight();
    var parentNumHorizontal = parentLevel.numHorizontalTiles();
    var parentNumVertical = parentLevel.numVerticalTiles();

    if (width % parentWidth !== 0) {
      throw new Error(
        'Level width must be multiple of parent level: ' +
          width +
          ' vs. ' +
          parentWidth
      );
    }

    if (height % parentHeight !== 0) {
      throw new Error(
        'Level height must be multiple of parent level: ' +
          height +
          ' vs. ' +
          parentHeight
      );
    }

    if (numHorizontal % parentNumHorizontal !== 0) {
      throw new Error(
        'Number of horizontal tiles must be multiple of parent level: ' +
          numHorizontal +
          ' (' +
          width +
          '/' +
          tileWidth +
          ')' +
          ' vs. ' +
          parentNumHorizontal +
          ' (' +
          parentWidth +
          '/' +
          parentTileWidth +
          ')'
      );
    }

    if (numVertical % parentNumVertical !== 0) {
      throw new Error(
        'Number of vertical tiles must be multiple of parent level: ' +
          numVertical +
          ' (' +
          height +
          '/' +
          tileHeight +
          ')' +
          ' vs. ' +
          parentNumVertical +
          ' (' +
          parentHeight +
          '/' +
          parentTileHeight +
          ')'
      );
    }
  }
}

/**
 * @class CubeGeometry
 * @implements Geometry
 * @classdesc
 *
 * A {@link Geometry} implementation suitable for tiled cube images with
 * multiple resolution levels.
 *
 * The following restrictions apply:
 *   - All tiles in a level must be square and form a rectangular grid;
 *   - The size of a level must be a multiple of the tile size;
 *   - The size of a level must be a multiple of the parent level size;
 *   - The number of tiles in a level must be a multiple of the number of tiles
 *     in the parent level.
 *
 * @param {Object[]} levelPropertiesList Level description
 * @param {number} levelPropertiesList[].size Cube face size in pixels
 * @param {number} levelPropertiesList[].tileSize Tile size in pixels
 */
class CubeGeometry {
  levelList: any[];
  selectableLevelList: unknown[];
  _tileSearcher: TileSearcher;
  _neighborsCache: LruMap;
  _vec: vec4;
  _viewSize: Size;
  static Tile: typeof CubeTile;
  Tile = CubeTile;
  type = 'cube' as const;
  constructor(levelPropertiesList) {
    if (getType(levelPropertiesList) !== 'array') {
      throw new Error('Level list must be an array');
    }

    this.levelList = makeLevelList(levelPropertiesList, CubeLevel);
    this.selectableLevelList = makeSelectableLevelList(this.levelList);

    for (var i = 1; i < this.levelList.length; i++) {
      this.levelList[i]._validateWithParentLevel(this.levelList[i - 1]);
    }

    this._tileSearcher = new TileSearcher();

    this._neighborsCache = new LruMap(neighborsCacheSize);

    this._vec = vec4.create();

    this._viewSize = { width: 0, height: 0 };
  }
  maxTileSize() {
    var maxTileSize = 0;
    for (var i = 0; i < this.levelList.length; i++) {
      var level = this.levelList[i];
      maxTileSize = Math.max(maxTileSize, level.tileWidth, level.tileHeight);
    }
    return maxTileSize;
  }
  levelTiles(level, result) {
    var levelIndex = this.levelList.indexOf(level);
    var maxX = level.numHorizontalTiles() - 1;
    var maxY = level.numVerticalTiles() - 1;

    result = result || [];

    for (var f = 0; f < faceList.length; f++) {
      var face = faceList[f];
      for (var x = 0; x <= maxX; x++) {
        for (var y = 0; y <= maxY; y++) {
          result.push(new CubeTile(face, x, y, levelIndex, this));
        }
      }
    }

    return result;
  }
  _closestTile(view, level) {
    var ray = this._vec;

    // Compute a view ray into the central screen point.
    vec4.set(ray, 0, 0, 1, 1);
    vec4.transformMat4(ray, ray, view.inverseProjection());

    var minAngle = Infinity;
    var closestFace: string | null = null;

    // Find the face whose vector makes a minimal angle with the view ray.
    // This is the face into which the view ray points.
    for (var face in faceVectors) {
      var vector = faceVectors[face];
      // For a small angle between two normalized vectors, angle ~ 1-cos(angle).
      // @ts-ignore
      var angle = 1 - vec3.dot(vector, ray); // figure out if this should be vec3 for ray
      if (angle < minAngle) {
        minAngle = angle;
        closestFace = face;
      }
    }

    // Project view ray onto cube, i.e., normalize the coordinate with
    // largest absolute value to ±0.5.
    var max =
      Math.max(Math.abs(ray[0]), Math.abs(ray[1]), Math.abs(ray[2])) / 0.5;
    for (var i = 0; i < 3; i++) {
      ray[i] = ray[i] / max;
    }

    // Rotate view ray into front face.
    var rot = faceRotation[closestFace as string];
    rotateVector(ray, 0, -rot.x, -rot.y);

    // Get the desired zoom level.
    var tileZ = this.levelList.indexOf(level);
    var numX = level.numHorizontalTiles();
    var numY = level.numVerticalTiles();

    // Find the coordinates of the tile that the view ray points into.
    var tileX = clamp(Math.floor((0.5 + ray[0]) * numX), 0, numX - 1);
    var tileY = clamp(Math.floor((0.5 - ray[1]) * numY), 0, numY - 1);

    return new CubeTile(closestFace, tileX, tileY, tileZ, this);
  }
  visibleTiles(view, level, result) {
    var viewSize = this._viewSize;
    var tileSearcher = this._tileSearcher;

    result = result || [];

    view.size(viewSize);
    if (viewSize.width === 0 || viewSize.height === 0) {
      // No tiles are visible if the viewport is empty.
      return result;
    }

    var startingTile = this._closestTile(view, level);
    var count = tileSearcher.search(view, startingTile, result);
    if (!count) {
      throw new Error('Starting tile is not visible');
    }

    return result;
  }
}

// TODO: remove these when migrating to export only
// @ts-ignore
CubeGeometry.Tile = CubeGeometry.prototype.Tile = CubeTile;
// @ts-ignore
CubeGeometry.type = CubeGeometry.prototype.type = 'cube';
// @ts-ignore
CubeTile.type = CubeTile.prototype.type = 'cube';

export {
  CubeTile
}
export default CubeGeometry;
