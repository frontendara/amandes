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
import eventEmitter from 'minimal-event-emitter';
import WorkQueue from '../collections/WorkQueue';
import calcRect from '../util/calcRect';
import async from '../util/async';
import cancelize from '../util/cancelize';
import clearOwnProperties from '../util/clearOwnProperties';

import RendererRegistry from './RendererRegistry';
import { Asset, Rect, Renderer, Size, Texture, Tile } from '../jsdoc-extras';
import Layer from '../Layer';

function forwardTileCmp(t1, t2) {
  return t1.cmp(t2);
}

function reverseTileCmp(t1, t2) {
  return -t1.cmp(t2);
}

/**
 * Signals that the stage has been rendered.
 *
 * @param {boolean} stable Whether all tiles were successfully rendered without
 *     missing textures or resorting to fallbacks.
 * @event Stage#renderComplete
 */

/**
 * Signals that the contents of the stage have been invalidated and must be
 * rendered again.
 *
 * This is used by the {@link RenderLoop} implementation.
 *
 * @event Stage#renderInvalid
 */

/**
 * @interface Stage
 * @classdesc
 *
 * A Stage is a container with the ability to render a stack of
 * {@link Layer layers}.
 *
 * This class should never be instantiated directly. Use {@link WebGlStage}
 * instead.
 *
 * @param {Object} opts
 * @param {boolean} [opts.progressive=false]
 *
 * Options listed here may be passed into the `opts` constructor argument of
 * subclasses.
 *
 * The `progressive` option controls whether resolution levels are loaded in
 * order, from lowest to highest. This results in a more pleasing effect when
 * zooming past several levels in a large panoramas, but consumes additional
 * bandwidth.
 */
class Stage {
  _progressive: boolean;
  _layers: Layer[];
  _renderers: Renderer[];
  _tilesToLoad: never[];
  _tilesToRender: never[];
  _tmpVisible: never[];
  _tmpChildren: never[];
  _width: number;
  _height: number;
  _tmpRect: Required<Rect>;
  _tmpSize: Size;
  _createTextureWorkQueue: WorkQueue;
  _rendererRegistry: RendererRegistry;
  type = 'stage';
  // TODO: adding this breaks everything
  TextureClass: Texture | null = null;
  constructor(opts) {
    this._progressive = !!(opts && opts.progressive);

    // The list of layers in display order (background to foreground).
    this._layers = [];

    // The list of renderers; the i-th renderer is for the i-th layer.
    this._renderers = [];

    // The lists of tiles to load and render, populated during render().
    this._tilesToLoad = [];
    this._tilesToRender = [];

    // Temporary tile lists.
    this._tmpVisible = [];
    this._tmpChildren = [];

    // Cached stage dimensions.
    // Start with zero, which inhibits rendering until setSize() is called.
    this._width = 0;
    this._height = 0;

    // Temporary variable for rect.
    this._tmpRect = { x: 0, y: 0, width: 0, height: 0 };

    // Temporary variable for size.
    this._tmpSize = { width: 0, height: 0 };

    // Work queue for createTexture.
    this._createTextureWorkQueue = new WorkQueue();

    // Function to emit event when render parameters have changed.
    this._emitRenderInvalid = this._emitRenderInvalid.bind(this);

    // The renderer registry maps each geometry/view pair into the respective
    // Renderer class.
    this._rendererRegistry = new RendererRegistry();
  }
  /**
   * Destructor.
   */
  destroy() {
    this.removeAllLayers();
    clearOwnProperties(this);
  }
  /**
   * Registers a {@link Renderer} for the given {@link Geometry} and {@link View}
   * type.
   *
   * The {@link registerDefaultRenderers} utility function may be used to
   * register all known renderers for a stage type into that stage. Most users
   * will not need to register renderers, as {@link Viewer} does it for them.
   *
   * @param {string} geometryType The geometry type, as given by
   *     {@link Geometry#type}.
   * @param {string} viewType The view type, as given by {@link View#type}.
   * @param {*} Renderer The renderer class.
   */
  registerRenderer(geometryType: string, viewType: string, Renderer: any) {
    return this._rendererRegistry.set(geometryType, viewType, Renderer);
  }
  /**
   * Returns the underlying DOM element.
   *
   * Must be overridden by subclasses.
   *
   * @return {Element}
   */
  domElement(): Element {
    throw new Error('Stage implementation must override domElement');
  }
  /**
   * Get the stage width.
   * @return {number}
   */
  width(): number {
    return this._width;
  }
  /**
   * Get the stage height.
   * @return {number}
   */
  height(): number {
    return this._height;
  }
  /**
   * Get the stage dimensions. If an argument is supplied, it is filled in with
   * the result and returned. Otherwise, a fresh object is filled in and returned.
   */
  size(size?: Size) {
    size = size || { width: 0, height: 0 };
    size.width = this._width;
    size.height = this._height;
    return size;
  }
  /**
   * Set the stage dimensions.
   *
   * This contains the size update logic common to all stage types. Subclasses
   * must define the {@link Stage#setSizeForType} method to perform their own
   * logic.
   *
   * @param {Size} size
   */
  setSize(size: Size) {
    this._width = size.width;
    this._height = size.height;

    this.setSizeForType(); // must be defined by subclasses.

    this.emit('resize');
    this._emitRenderInvalid();
  }
  emit(_arg0: string, _arg1?: any) {
    throw new Error('Method not implemented.');
  }
  /**
   * Call {@link Stage#setSize} instead.
   *
   * This contains the size update logic specific to a stage type. It is called by
   * {@link Stage#setSize} after the base class has been updated to reflect the
   * new size, but before any events are emitted.
   *
   * @param {Size} _size
   */
  setSizeForType(_size?: Size) {
    throw new Error('Stage implementation must override setSizeForType');
  }
  /**
   * Loads an {@link Asset} from an image.
   * @param {string} url The image URL.
   * @param {?Rect} rect A {@link Rect} describing a portion of the image, or null
   *     to use the full image.
   * @param {function(?Error, Asset)} done The callback.
   * @return {function()} A function to cancel loading.
   */
  loadImage(): () => any {
    throw new Error('Stage implementation must override loadImage');
  }
  /**
   * Verifies that the layer is valid for this stage, throwing an exception
   * otherwise.
   *
   * @param {Layer} _layer
   * @throws {Error} If the layer is not valid for this stage.
   */
  validateLayer(_layer: Layer) {
    throw new Error('Stage implementation must override validateLayer');
  }
  /**
   * Returns a list of all {@link Layer layers} belonging to the stage. The
   * returned list is in display order, background to foreground.
   * @return {Layer[]}
   */
  listLayers(): Layer[] {
    // Return a copy to prevent unintended mutation by the caller.
    return [...this._layers];
  }
  /**
   * Return whether a {@link Layer layer} belongs to the stage.
   * @param layer
   * @return {boolean}
   */
  hasLayer(layer: Layer): boolean {
    return this._layers.indexOf(layer) >= 0;
  }
  /**
   * Adds a {@link Layer layer} into the stage.
   * @param {Layer} layer The layer to add.
   * @param {number|undefined} i The optional position, where 0 ≤ i ≤ n and n is
   *     the current number of layers. The default is n, which inserts at the
   *     top of the display stack.
   * @throws An error if the layer already belongs to the stage or if the position
   *     is invalid.
   */
  addLayer(layer: Layer, i?: number) {
    if (this._layers.indexOf(layer) >= 0) {
      throw new Error('Layer already in stage');
    }

    if (i == null) {
      i = this._layers.length;
    }
    if (i < 0 || i > this._layers.length) {
      throw new Error('Invalid layer position');
    }

    this.validateLayer(layer); // must be defined by subclasses.

    var geometryType = layer.geometry().type;
    var viewType = layer.view().type;
    var rendererClass = this._rendererRegistry.get(geometryType, viewType);
    if (!rendererClass) {
      throw new Error(
        'No ' +
          this.type +
          ' renderer avaiable for ' +
          geometryType +
          ' geometry and ' +
          viewType +
          ' view'
      );
    }
    var renderer = this.createRenderer(rendererClass);

    this._layers.splice(i, 0, layer);
    this._renderers.splice(i, 0, renderer);

    // Listeners for render invalid.
    layer.addEventListener('viewChange', this._emitRenderInvalid);
    layer.addEventListener('effectsChange', this._emitRenderInvalid);
    layer.addEventListener('fixedLevelChange', this._emitRenderInvalid);
    layer.addEventListener('textureStoreChange', this._emitRenderInvalid);

    this._emitRenderInvalid();
  }
  createRenderer(_rendererClass: any): Renderer {
    throw new Error('Method not implemented.');
  }
  /**
   * Moves a {@link Layer layer} into a different position in the display stack.
   * @param {Layer} layer The layer to move.
   * @param {number} i The position, where 0 ≤ i ≤ n-1 and n is the current number
   *     of layers.
   * @throws An error if the layer does not belong to the stage or if the position
   *     is invalid.
   */
  moveLayer(layer: Layer, i: number) {
    var index = this._layers.indexOf(layer);
    if (index < 0) {
      throw new Error('No such layer in stage');
    }

    if (i < 0 || i >= this._layers.length) {
      throw new Error('Invalid layer position');
    }

    layer = this._layers.splice(index, 1)[0];
    var renderer = this._renderers.splice(index, 1)[0];

    this._layers.splice(i, 0, layer);
    this._renderers.splice(i, 0, renderer);

    this._emitRenderInvalid();
  }
  /**
   * Removes a {@link Layer} from the stage.
   * @param {Layer} layer The layer to remove.
   * @throws An error if the layer does not belong to the stage.
   */
  removeLayer(layer: Layer) {
    var index = this._layers.indexOf(layer);
    if (index < 0) {
      throw new Error('No such layer in stage');
    }

    var removedLayer = this._layers.splice(index, 1)[0];
    var renderer = this._renderers.splice(index, 1)[0];

    this.destroyRenderer(renderer);

    removedLayer.removeEventListener('viewChange', this._emitRenderInvalid);
    removedLayer.removeEventListener('effectsChange', this._emitRenderInvalid);
    removedLayer.removeEventListener(
      'fixedLevelChange',
      this._emitRenderInvalid
    );
    removedLayer.removeEventListener(
      'textureStoreChange',
      this._emitRenderInvalid
    );

    this._emitRenderInvalid();
  }
  destroyRenderer(_renderer: any) {
    throw new Error('Method not implemented.');
  }
  /**
   * Removes all {@link Layer layers} from the stage.
   */
  removeAllLayers() {
    while (this._layers.length > 0) {
      this.removeLayer(this._layers[0]);
    }
  }
  /**
   * Called before a frame is rendered.
   *
   * Must be overridden by subclasses.
   */
  startFrame() {
    throw new Error('Stage implementation must override startFrame');
  }
  /**
   * Called after a frame is rendered.
   *
   * Must be overridden by subclasses.
   */
  endFrame() {
    throw new Error('Stage implementation must override endFrame');
  }
  /**
   * Render the current frame. Usually called from a {@link RenderLoop}.
   *
   * This contains the rendering logic common to all stage types. Subclasses
   * define the startFrame() and endFrame() methods to perform their own logic.
   */
  render() {
    var i, j;

    var tilesToLoad = this._tilesToLoad;
    var tilesToRender = this._tilesToRender;

    var stableStage = true;
    var stableLayer;

    // Get the stage dimensions.
    var width = this._width;
    var height = this._height;

    var rect = this._tmpRect;
    var size = this._tmpSize;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.startFrame(); // defined by subclasses

    // Signal start of frame to the texture stores.
    for (i = 0; i < this._layers.length; i++) {
      this._layers[i].textureStore().startFrame();
    }

    // Render layers.
    for (i = 0; i < this._layers.length; i++) {
      var layer = this._layers[i];
      var effects = layer.effects();
      var view = layer.view();
      var textureStore = layer.textureStore();
      var renderer = this._renderers[i];
      var depth = this._layers.length - i;
      var tile: Tile, texture: Texture;

      // Convert the rect effect into a normalized rect.
      // TODO: avoid doing this on every frame.
      calcRect(width, height, effects?.rect, rect);

      if (rect.width <= 0 || rect.height <= 0) {
        // Skip rendering on a null viewport.
        continue;
      }

      // Update the view size.
      size.width = rect.width * this._width;
      size.height = rect.height * this._height;
      view.setSize(size);

      // Signal start of layer to the renderer.
      renderer.startLayer(layer, rect);

      // We render with both alpha blending and depth testing enabled. Thus, when
      // rendering a subsequent pixel at the same location than an existing one,
      // the subsequent pixel gets discarded unless it has smaller depth, and is
      // otherwise composited with the existing pixel.
      //
      // When using fallback tiles to fill a gap in the preferred resolution
      // level, we prefer higher resolution fallbacks to lower resolution ones.
      // However, where fallbacks overlap, we want higher resolution ones to
      // prevail, and we don't want multiple fallbacks to be composited with each
      // other, as that would produce a bad result when semitransparent textures
      // are involved.
      //
      // In order to achieve this within the constraints of alpha blending and
      // depth testing, the depth of a tile must be inversely proportional to its
      // resolution, and higher-resolution tiles must be rendered before lower-
      // resolution ones.
      // Collect the lists of tiles to load and render.
      stableLayer = this._collectTiles(layer, textureStore);

      // Mark all the tiles whose textures must be loaded.
      // This will either trigger loading (for textures not yet loaded) or
      // prevent unloading (for textures already loaded).
      for (j = 0; j < tilesToLoad.length; j++) {
        tile = tilesToLoad[j];
        textureStore.markTile(tile);
      }

      // Render tiles.
      for (j = 0; j < tilesToRender.length; j++) {
        tile = tilesToRender[j];
        texture = textureStore.texture(tile);
        renderer.renderTile(tile, texture, layer, depth);
      }

      layer.emit('renderComplete', stableLayer);
      if (!stableLayer) {
        stableStage = false;
      }

      // Signal end of layer to the renderer.
      renderer.endLayer(layer, rect);
    }

    // Signal end of frame to the texture stores.
    for (i = 0; i < this._layers.length; i++) {
      this._layers[i].textureStore().endFrame();
    }

    this.endFrame(); // defined by subclasses

    this.emit('renderComplete', stableStage);
  }
  _collectTiles(layer, textureStore) {
    var tilesToLoad = this._tilesToLoad;
    var tilesToRender = this._tilesToRender;
    var tmpVisible = this._tmpVisible;

    tilesToLoad.length = 0;
    tilesToRender.length = 0;
    tmpVisible.length = 0;

    layer.visibleTiles(tmpVisible);

    var isStable = true;

    for (var i = 0; i < tmpVisible.length; i++) {
      var tile = tmpVisible[i];
      var needsFallback;
      this._collectTileToLoad(tile);
      if (textureStore.texture(tile)) {
        // The preferred texture is available.
        // No fallback is required.
        needsFallback = false;
        this._collectTileToRender(tile);
      } else {
        // The preferred texture is unavailable.
        // Collect children for rendering as a fallback.
        needsFallback = this._collectChildren(tile, textureStore);
        isStable = false;
      }
      // Collect all parents for loading, and the closest parent for rendering if
      // a fallback is required.
      this._collectParents(tile, textureStore, needsFallback);
    }

    // Sort tiles to load in ascending resolution order.
    tilesToLoad.sort(forwardTileCmp);

    // Sort tiles to render in descending resolution order.
    tilesToRender.sort(reverseTileCmp);

    return isStable;
  }
  _collectChildren(tile, textureStore) {
    var tmpChildren = this._tmpChildren;

    var needsFallback = true;

    // Fall back as many levels as necessary on single-child geometries, but do
    // not go beyond immediate children on multiple-child geometries, to avoid
    // exploring an exponential number of tiles.
    do {
      tmpChildren.length = 0;
      if (!tile.children(tmpChildren)) {
        break;
      }
      needsFallback = false;
      for (var i = 0; i < tmpChildren.length; i++) {
        tile = tmpChildren[i];
        if (textureStore.texture(tile)) {
          this._collectTileToLoad(tile);
          this._collectTileToRender(tile);
        } else {
          needsFallback = true;
        }
      }
    } while (needsFallback && tmpChildren.length === 1);

    return needsFallback;
  }
  _collectParents(tile, textureStore, needsFallback) {
    // Recursively visit parent tiles until:
    //   - all parents have been marked for loading, if progressive rendering is
    //     enabled; and
    //   - at least one parent has been marked for both loading and rendering, if
    //     a fallback is required.
    var needsLoading = this._progressive;
    while ((needsLoading || needsFallback) && (tile = tile.parent()) != null) {
      if (needsFallback) {
        if (textureStore.texture(tile)) {
          this._collectTileToRender(tile);
          needsFallback = false;
        } else if (!this._progressive) {
          continue;
        }
      }
      if (!this._collectTileToLoad(tile)) {
        needsLoading = false;
      }
    }
    return needsFallback;
  }
  _collectTileToLoad(tile) {
    return this._collectTileIntoList(tile, this._tilesToLoad);
  }
  _collectTileToRender(tile) {
    return this._collectTileIntoList(tile, this._tilesToRender);
  }
  _collectTileIntoList(tile, tileList) {
    // TODO: Investigate whether it's worth it to make this better than O(n²).
    var found = false;
    for (var i = 0; i < tileList.length; i++) {
      if (tile.equals(tileList[i])) {
        found = true;
        break;
      }
    }
    if (!found) {
      tileList.push(tile);
    }
    return !found;
  }
  /**
   * Create a texture for the given tile and asset. Called by {@link TextureStore}.
   * @param {Tile} tile
   * @param {Asset} asset
   * @param {Function} done
   */
  createTexture(tile: Tile, asset: Asset, done: Function) {
    var self = this;

    function makeTexture() {
      if (self.TextureClass) {
        return new self.TextureClass(self, tile, asset);
      }
      return null;
    }

    var fn = cancelize(async(makeTexture));

    return this._createTextureWorkQueue.push(fn, function (err, texture) {
      done(err, tile, asset, texture);
    });
  }
  _emitRenderInvalid() {
    this.emit('renderInvalid');
  }
}

eventEmitter(Stage);

Stage.prototype._emitRenderInvalid = function () {
  this.emit('renderInvalid');
};

/**
 * The stage type, used to determine the appropriate renderer for a given
 * geometry and view.
 *
 * The sole known value is `"webgl".
 *
 * See also {@link Stage#registerRenderer}.
 *
 * @property {string}
 * @name Stage#type
 */

export default Stage;
