import eventEmitter from "minimal-event-emitter";
import extend from "./util/extend";
import clearOwnProperties from "./util/clearOwnProperties";
import { Geometry, Source } from "./jsdoc-extras";
import TextureStore from "./TextureStore";

/**
 * Signals that the layer has been rendered.
 *
 * @param {boolean} stable Whether all tiles were successfully rendered without
 *     missing textures or resorting to fallbacks.
 * @event Layer#renderComplete
 */

/**
 * A Layer is a combination of {@link Source}, {@link Geometry}, {@link View}
 * and {@link TextureStore} that may be added into a {@link Stage} and rendered
 * with {@link Effects}.
 *
 */
class Layer {
  #source: any;
  #geometry: any;
  #view: any;
  #textureStore: any;
  #effects: any;
  #fixedLevelIndex: null;
  #viewChangeHandler: () => void;
  #textureStoreChangeHandler: () => void;

  constructor(
    source: Source,
    geometry: Geometry,
    view: any,
    textureStore: TextureStore,
    opts: { effects: unknown }
  ) {
    opts = opts || {};

    var self = this;

    this.#source = source;
    this.#geometry = geometry;
    this.#view = view;
    this.#textureStore = textureStore;

    this.#effects = opts.effects || {};

    this.#fixedLevelIndex = null;

    this.#viewChangeHandler = function () {
      self.emit("viewChange", self.view());
    };

    this.#view.addEventListener("change", this.#viewChangeHandler);

    this.#textureStoreChangeHandler = function () {
      self.emit("textureStoreChange", self.textureStore());
    };

    this.#textureStore.addEventListener(
      "textureLoad",
      this.#textureStoreChangeHandler
    );
    this.#textureStore.addEventListener(
      "textureError",
      this.#textureStoreChangeHandler
    );
    this.#textureStore.addEventListener(
      "textureInvalid",
      this.#textureStoreChangeHandler
    );
  }
  emit(_arg0: string, _arg1: any) {
    throw new Error("Method not implemented.");
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#view.removeEventListener("change", this.#viewChangeHandler);
    this.#textureStore.removeEventListener(
      "textureLoad",
      this.#textureStoreChangeHandler
    );
    this.#textureStore.removeEventListener(
      "textureError",
      this.#textureStoreChangeHandler
    );
    this.#textureStore.removeEventListener(
      "textureInvalid",
      this.#textureStoreChangeHandler
    );
    clearOwnProperties(this);
  }
  /**
   * Returns the underlying {@link Source source}.
   * @return {Source}
   */
  source() {
    return this.#source;
  }
  /**
   * Returns the underlying {@link Geometry geometry}.
   * @return {Geometry}
   */
  geometry() {
    return this.#geometry;
  }
  /**
   * Returns the underlying {@link View view}.
   * @return {View}
   */
  view() {
    return this.#view;
  }
  /**
   * Returns the underlying {@link TextureStore texture store}.
   * @return {TextureStore}
   */
  textureStore() {
    return this.#textureStore;
  }
  /**
   * Returns the currently set {@link Effects effects}.
   * @return {Effects}
   */
  effects() {
    return this.#effects;
  }
  /**
   * Sets the {@link Effects effects}.
   * @param {Effects} effects
   */
  setEffects(effects) {
    this.#effects = effects;
    this.emit("effectsChange", this.#effects);
  }
  /**
   * Merges effects into the currently set ones. The merge is non-recursive; for
   * instance, if current effects are `{ rect: { relativeWidth: 0.5 } }`,
   * calling this method with `{ rect: { relativeX: 0.5 }}` will reset
   * `rect.relativeWidth`.
   *
   * @param {Effects} effects
   */
  mergeEffects(effects) {
    extend(this.#effects, effects);
    this.emit("effectsChange", this.#effects);
  }
  /**
   * Returns the fixed level index.
   * @return {(number|null)}
   */
  fixedLevel() {
    return this.#fixedLevelIndex;
  }
  /**
   * Sets the fixed level index. When set, the corresponding level will be
   * used regardless of the view parameters. Unset with a null argument.
   *
   * @param {(number|null)} levelIndex
   * @throws An error if the level index is out of range.
   */
  setFixedLevel(levelIndex) {
    if (levelIndex !== this.#fixedLevelIndex) {
      if (
        levelIndex != null &&
        (levelIndex >= this.#geometry.levelList.length || levelIndex < 0)
      ) {
        throw new Error("Level index out of range: " + levelIndex);
      }
      this.#fixedLevelIndex = levelIndex;
      this.emit("fixedLevelChange", this.#fixedLevelIndex);
    }
  }
  #selectLevel() {
    var level;
    if (this.#fixedLevelIndex != null) {
      level = this.#geometry.levelList[this.#fixedLevelIndex];
    } else {
      level = this.#view.selectLevel(this.#geometry.selectableLevelList);
    }
    return level;
  }
  visibleTiles(result) {
    var level = this.#selectLevel();
    return this.#geometry.visibleTiles(this.#view, level, result);
  }
  /**
   * Pin a whole level into the texture store.
   * @param {Number} levelIndex
   */
  pinLevel(levelIndex) {
    var level = this.#geometry.levelList[levelIndex];
    var tiles = this.#geometry.levelTiles(level);
    for (var i = 0; i < tiles.length; i++) {
      this.#textureStore.pin(tiles[i]);
    }
  }
  /**
   * Unpin a whole level from the texture store.
   * @param {Number} levelIndex
   */
  unpinLevel(levelIndex) {
    var level = this.#geometry.levelList[levelIndex];
    var tiles = this.#geometry.levelTiles(level);
    for (var i = 0; i < tiles.length; i++) {
      this.#textureStore.unpin(tiles[i]);
    }
  }
  /**
   * Pin the first level. Equivalent to `pinLevel(0)`.
   */
  pinFirstLevel() {
    return this.pinLevel(0);
  }
  /**
   * Unpin the first level. Equivalent to `unpinLevel(0)`.
   */
  unpinFirstLevel() {
    return this.unpinLevel(0);
  }
}

eventEmitter(Layer);

export default Layer;
