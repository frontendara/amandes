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

import Map from "./collections/Map";
import Set from "./collections/Set";
import LruSet from "./collections/LruSet";
import eventEmitter from "minimal-event-emitter";
import defaults from "./util/defaults";
import retry from "./util/retry";
import chain from "./util/chain";
import clearOwnProperties from "./util/clearOwnProperties";

var debug =
  // @ts-ignore
  typeof MARZIPANODEBUG !== "undefined" && MARZIPANODEBUG.textureStore;

// A Stage informs the TextureStore about the set of visible tiles during a
// frame by calling startFrame, markTile and endFrame. In a particular frame,
// TextureStore expects one or more calls to startFrame, followed by zero or
// more calls to markTile, followed by one or more calls to endFrame. The
// number of calls to startFrame and endFrame must match. Calls to other
// TextureStore methods may be freely interleaved with this sequence.
//
// At any given time, TextureStore is in one of four states. The START state
// corresponds to the interval between the first startFrame and the first
// markTile of a frame. The MARK state corresponds to the interval between the
// first markTile and the first endFrame. The END state corresponds to the
// interval between the first and the last endFrame. At any other time, the
// TextureStore is in the IDLE state.
var State = {
  IDLE: 0,
  START: 1,
  MARK: 2,
  END: 3,
};

var defaultOptions = {
  // Maximum number of cached textures for previously visible tiles.
  previouslyVisibleCacheSize: 512,
};

// Assign an id to each operation so we can track its state.
// We actually only need this in debug mode, but the code is less convoluted
// if we track unconditionally, and the performance hit is minimal anyway.
var nextId = 0;

// Distinguishes a cancellation from other kinds of errors.
class CancelError extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args);
  }
}

/**
 * @class TextureStoreItem
 * @classdesc
 *
 * An item saved in a {@link TextureStore}.
 *
 * Clients do not need to instantiate this. It is automatically instantiated by
 * a {@link TextureStore} to manage the lifetime of a stored item: loading,
 * refreshing, unloading and emitting associated events.
 *
 * @param {TextureStore} store The underlying {@link TextureStore}.
 * @param {Tile} tile The underlying tile.
 */
class TextureStoreItem {
  #id: number;
  #store: any;
  #tile: any;
  #asset: any;
  #texture: any;
  #changeHandler: () => void;
  #cancel: null | ((...args: any[]) => void);

  constructor(store, tile) {
    var id = nextId++;

    this.#id = id;
    this.#store = store;
    this.#tile = tile;

    this.#asset = null;
    this.#texture = null;

    this.#changeHandler = () => {
      store.emit("textureInvalid", tile);
    };

    var source = store.source();
    var stage = store.stage();

    var loadAsset = source.loadAsset.bind(source);
    var createTexture = stage.createTexture.bind(stage);

    // Retry loading the asset until it succeeds, then create the texture from it.
    // This process may be canceled at any point by calling the destroy() method.
    var fn = chain(retry(loadAsset), createTexture);

    store.emit("textureStartLoad", tile);
    if (debug) {
      console.log("loading", id, tile);
    }

    this.#cancel = fn(stage, tile, (err, _tile, asset, texture) => {
      // Make sure we do not call cancel after the operation is complete.
      this.#cancel = null;

      if (err) {
        // The loading process was interrupted by an error.
        // This could either be because the texture creation failed, or because
        // the operation was canceled before the loading was complete.
        // Destroy the asset and texture, if they exist.
        if (asset) {
          asset.destroy();
        }
        if (texture) {
          texture.destroy();
        }

        // Emit events.
        if (err instanceof CancelError) {
          store.emit("textureCancel", tile);
          if (debug) {
            console.log("cancel", id, tile);
          }
        } else {
          store.emit("textureError", tile, err);
          if (debug) {
            console.log("error", id, tile);
          }
        }

        return;
      }

      // Save a local reference to the texture.
      this.#texture = texture;

      // If the asset is dynamic, save a local reference to it and set up a
      // handler to be called whenever it changes. Otherwise, destroy the asset
      // as we won't be needing it any longer.
      if (asset.isDynamic()) {
        this.#asset = asset;
        asset.addEventListener("change", this.#changeHandler);
      } else {
        asset.destroy();
      }

      // Emit event.
      store.emit("textureLoad", tile);
      if (debug) {
        console.log("load", id, tile);
      }
    });
  }
  asset() {
    return this.#asset;
  }
  texture() {
    return this.#texture;
  }
  destroy() {
    var id = this.#id;
    var store = this.#store;
    var tile = this.#tile;
    var asset = this.#asset;
    var texture = this.#texture;
    var cancel = this.#cancel;

    if (cancel) {
      // The texture is still loading, so cancel it.
      cancel(new CancelError("Texture load cancelled"));
      return;
    }

    // Destroy asset.
    if (asset) {
      asset.removeEventListener("change", this.#changeHandler);
      asset.destroy();
    }

    // Destroy texture.
    if (texture) {
      texture.destroy();
    }

    // Emit event.
    store.emit("textureUnload", tile);
    if (debug) {
      console.log("unload", id, tile);
    }

    clearOwnProperties(this);
  }
}

eventEmitter(TextureStoreItem);

/**
 * Signals that a texture has started to load.
 *
 * This event is followed by either {@link TextureStore#textureLoad},
 * {@link TextureStore#textureError} or {@link TextureStore#textureCancel}.
 *
 * @event TextureStore#textureStartLoad
 * @param {Tile} tile The tile for which the texture has started to load.
 */

/**
 * Signals that a texture has been loaded.
 *
 * @event TextureStore#textureLoad
 * @param {Tile} tile The tile for which the texture was loaded.
 */

/**
 * Signals that a texture has been unloaded.
 *
 * @event TextureStore#textureUnload
 * @param {Tile} tile The tile for which the texture was unloaded.
 */

/**
 * Signals that a texture has been invalidated.
 *
 * This event may be raised for a texture with an underlying dynamic asset. It
 * may only occur while the texture is loaded, i.e., in between
 * {@link TextureStore#textureLoad} and {@link TextureStore#textureUnload}.
 *
 * @event TextureStore#textureInvalid
 * @param {Tile} tile The tile for which the texture was invalidated.
 */

/**
 * Signals that loading a texture has been cancelled.
 *
 * This event may follow {@link TextureStore#textureStartLoad} if the texture
 * becomes unnecessary before it finishes loading.
 *
 * @event TextureStore#textureCancel
 * @param {Tile} tile The tile for which the texture loading was cancelled.
 */

/**
 * Signals that loading a texture has failed.
 *
 * This event may follow {@link TextureStore#textureStartLoad} if the texture
 * fails to load.
 *
 * @event TextureStore#textureError
 * @param {Tile} tile The tile for which the texture loading has failed.
 */

/**
 * @class TextureStore
 * @classdesc
 *
 * A TextureStore maintains a cache of textures used to render a {@link Layer}.
 *
 * A {@link Stage} communicates with the TextureStore through the startFrame(),
 * markTile() and endFrame() methods, which indicate the tiles that are visible
 * in the current frame. Textures for visible tiles are loaded and retained
 * as long as the tiles remain visible. A limited amount of textures whose
 * tiles were previously visible are cached according to an LRU policy. Tiles
 * may be pinned to keep their respective textures cached even when they are
 * invisible; these textures do not count towards the previously visible limit.
 *
 * Multiple layers belonging to the same underlying {@link WebGlStage} may
 * share the same TextureStore. Layers belonging to distinct {@link WebGlStage}
 * instances may not do so due to restrictions on the use of textures across
 * stages.
 *
 * @param {Source} source The underlying source.
 * @param {Stage} stage The underlying stage.
 * @param {Object} opts Options.
 * @param {Number} [opts.previouslyVisibleCacheSize=32] The maximum number of
 *     previously visible textures to cache according to an LRU policy.
 */
class TextureStore {
  #source: any;
  #stage: any;
  #state: number;
  #delimCount: number;
  #itemMap: Map;
  #visible: Set;
  #previouslyVisible: LruSet;
  #pinMap: Map;
  #newVisible: Set;
  #noLongerVisible: any[];
  #visibleAgain: any[];
  #evicted: any[];
  constructor(source, stage, opts) {
    opts = defaults(opts || {}, defaultOptions);

    this.#source = source;
    this.#stage = stage;

    // The current state.
    this.#state = State.IDLE;

    // The number of startFrame calls yet to be matched by endFrame calls during
    // the current frame.
    this.#delimCount = 0;

    // The cache proper: map cached tiles to their respective textures/assets.
    this.#itemMap = new Map();

    // The subset of cached tiles that are currently visible.
    this.#visible = new Set();

    // The subset of cached tiles that were visible recently, but are not
    // visible right now. Newly inserted tiles replace older ones.
    this.#previouslyVisible = new LruSet(opts.previouslyVisibleCacheSize);

    // The subset of cached tiles that should never be evicted from the cache.
    // A tile may be pinned more than once; map each tile into a reference count.
    this.#pinMap = new Map();

    // Temporary variables.
    this.#newVisible = new Set();
    this.#noLongerVisible = [];
    this.#visibleAgain = [];
    this.#evicted = [];
  }
  /**
   * Destructor.
   */
  destroy() {
    this.clear();
    clearOwnProperties(this);
  }
  /**
   * Return the underlying {@link Stage}.
   * @return {Stage}
   */
  stage() {
    return this.#stage;
  }
  /**
   * Return the underlying {@link Source}.
   * @return {Source}
   */
  source() {
    return this.#source;
  }
  /**
   * Remove all textures from the TextureStore, including pinned textures.
   */
  clear() {
    var self = this;

    // Collect list of tiles to be evicted.
    self.#evicted.length = 0;
    self.#itemMap.forEach(function (tile) {
      self.#evicted.push(tile);
    });

    // Evict tiles.
    self.#evicted.forEach(function (tile) {
      self.#unloadTile(tile);
    });

    // Clear all internal state.
    self.#itemMap.clear();
    self.#visible.clear();
    self.#previouslyVisible.clear();
    self.#pinMap.clear();
    self.#newVisible.clear();
    self.#noLongerVisible.length = 0;
    self.#visibleAgain.length = 0;
    self.#evicted.length = 0;
  }
  /**
   * Remove all textures in the TextureStore, excluding unpinned textures.
   */
  clearNotPinned() {
    // Collect list of tiles to be evicted.
    this.#evicted.length = 0;
    this.#itemMap.forEach((tile) => {
      if (!this.#pinMap.has(tile)) {
        this.#evicted.push(tile);
      }
    });

    // Evict tiles.
    this.#evicted.forEach((tile) => {
      this.#unloadTile(tile);
    });

    // Clear all caches except the pinned set.
    this.#visible.clear();
    this.#previouslyVisible.clear();

    // Clear temporary variables.
    this.#evicted.length = 0;
  }
  /**
   * Signal the beginning of a frame. Called from {@link Stage}.
   */
  startFrame() {
    // Check that we are in an appropriate state.
    if (this.#state !== State.IDLE && this.#state !== State.START) {
      throw new Error("TextureStore: startFrame called out of sequence");
    }

    // Enter the START state, if not already there.
    this.#state = State.START;

    // Expect one more endFrame call.
    this.#delimCount++;
  }
  /**
   * Mark a tile as visible within the current frame. Called from {@link Stage}.
   * @param {Tile} tile The tile to mark.
   */
  markTile(tile) {
    // Check that we are in an appropriate state.
    if (this.#state !== State.START && this.#state !== State.MARK) {
      throw new Error("TextureStore: markTile called out of sequence");
    }

    // Enter the MARK state, if not already there.
    this.#state = State.MARK;

    // Refresh texture for dynamic assets.
    var item = this.#itemMap.get(tile);
    var texture = item && item.texture();
    var asset = item && item.asset();
    if (texture && asset) {
      texture.refresh(tile, asset);
    }

    // Add tile to the visible set.
    this.#newVisible.add(tile);
  }
  /**
   * Signal the end of a frame. Called from {@link Stage}.
   */
  endFrame() {
    // Check that we are in an appropriate state.
    if (
      this.#state !== State.START &&
      this.#state !== State.MARK &&
      this.#state !== State.END
    ) {
      throw new Error("TextureStore: endFrame called out of sequence");
    }

    // Enter the END state, if not already there.
    this.#state = State.END;

    // Expect one less call to endFrame.
    this.#delimCount--;

    // If no further calls are expected, process frame and enter the IDLE state.
    if (!this.#delimCount) {
      this.#update();
      this.#state = State.IDLE;
    }
  }
  #update() {
    var self = this;

    // Calculate the set of tiles that used to be visible but no longer are.
    self.#noLongerVisible.length = 0;
    self.#visible.forEach(function (tile) {
      if (!self.#newVisible.has(tile)) {
        self.#noLongerVisible.push(tile);
      }
    });

    // Calculate the set of tiles that were visible recently and have become
    // visible again.
    self.#visibleAgain.length = 0;
    self.#newVisible.forEach(function (tile) {
      if (self.#previouslyVisible.has(tile)) {
        self.#visibleAgain.push(tile);
      }
    });

    // Remove tiles that have become visible again from the list of previously
    // visible tiles.
    self.#visibleAgain.forEach(function (tile) {
      self.#previouslyVisible.remove(tile);
    });

    // Cancel loading of tiles that are no longer visible.
    // Move no longer visible tiles with a loaded texture into the previously
    // visible set, and collect the tiles evicted from the latter.
    self.#evicted.length = 0;
    self.#noLongerVisible.forEach(function (tile) {
      var item = self.#itemMap.get(tile);
      var texture = item && item.texture();
      if (texture) {
        var otherTile = self.#previouslyVisible.add(tile);
        if (otherTile != null) {
          self.#evicted.push(otherTile);
        }
      } else if (item) {
        self.#unloadTile(tile);
      }
    });

    // Unload evicted tiles, unless they are pinned.
    self.#evicted.forEach(function (tile) {
      if (!self.#pinMap.has(tile)) {
        self.#unloadTile(tile);
      }
    });

    // Load visible tiles that are not already in the store.
    // Refresh texture on visible tiles for dynamic assets.
    self.#newVisible.forEach(function (tile) {
      var item = self.#itemMap.get(tile);
      if (!item) {
        self.#loadTile(tile);
      }
    });

    // Swap the old visible set with the new one.
    var tmp = self.#visible;
    self.#visible = self.#newVisible;
    self.#newVisible = tmp;

    // Clear the new visible set.
    self.#newVisible.clear();

    // Clear temporary variables.
    self.#noLongerVisible.length = 0;
    self.#visibleAgain.length = 0;
    self.#evicted.length = 0;
  }
  #loadTile(tile) {
    if (this.#itemMap.has(tile)) {
      throw new Error("TextureStore: loading texture already in cache");
    }
    var item = new TextureStoreItem(this, tile);
    this.#itemMap.set(tile, item);
  }
  #unloadTile(tile) {
    var item = this.#itemMap.del(tile);
    if (!item) {
      throw new Error("TextureStore: unloading texture not in cache");
    }
    item.destroy();
  }
  asset(tile) {
    var item = this.#itemMap.get(tile);
    if (item) {
      return item.asset();
    }
    return null;
  }
  texture(tile) {
    var item = this.#itemMap.get(tile);
    if (item) {
      return item.texture();
    }
    return null;
  }
  /**
   * Pin a tile. Textures for pinned tiles are never evicted from the store.
   * Upon pinning, the texture is created if not already present. Pins are
   * reference-counted; a tile may be pinned multiple times and must be unpinned
   * the corresponding number of times. Pinning is useful e.g. to ensure that
   * the lowest-resolution level of an image is always available to fall back
   * onto.
   * @param {Tile} tile the tile to pin
   * @returns {number} the pin reference count.
   */
  pin(tile) {
    // Increment reference count.
    var count = (this.#pinMap.get(tile) || 0) + 1;
    this.#pinMap.set(tile, count);
    // If the texture for the tile is not present, load it now.
    if (!this.#itemMap.has(tile)) {
      this.#loadTile(tile);
    }
    return count;
  }
  /**
   * Unpin a tile. Pins are reference-counted; a tile may be pinned multiple
   * times and must be unpinned the corresponding number of times.
   * @param {Tile} tile the tile to unpin
   * @returns {number} the pin reference count.
   */
  unpin(tile) {
    var count = this.#pinMap.get(tile);
    // Consistency check.
    if (!count) {
      throw new Error("TextureStore: unpin when not pinned");
    } else {
      // Decrement reference count.
      count--;
      if (count > 0) {
        this.#pinMap.set(tile, count);
      } else {
        this.#pinMap.del(tile);
        // If the tile does not belong to either the visible or previously
        // visible sets, evict it from the cache.
        if (!this.#visible.has(tile) && !this.#previouslyVisible.has(tile)) {
          this.#unloadTile(tile);
        }
      }
    }
    return count;
  }
  /**
   * Return type for {@link TextureStore#query}.
   * @typedef {Object} TileState
   * @property {boolean} visible Whether the tile is in the visible set.
   * @property {boolean} previouslyVisible Whether the tile is in the previously
   *     visible set.
   * @property {boolean} hasAsset Whether the asset for the tile is present.
   * @property {boolean} hasTexture Whether the texture for the tile is present.
   * @property {boolean} pinned Whether the tile is in the pinned set.
   * @property {number} pinCount The pin reference count for the tile.
   */
  /**
   * Return the state of a tile.
   * @param {Tile} tile The tile to query.
   * @return {TileState}
   */
  query(tile) {
    var item = this.#itemMap.get(tile);
    var pinCount = this.#pinMap.get(tile) || 0;
    return {
      visible: this.#visible.has(tile),
      previouslyVisible: this.#previouslyVisible.has(tile),
      hasAsset: item != null && item.asset() != null,
      hasTexture: item != null && item.texture() != null,
      pinned: pinCount !== 0,
      pinCount: pinCount,
    };
  }
}

eventEmitter(TextureStore);

export default TextureStore;
