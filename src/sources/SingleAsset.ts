/**
 * @class SingleAssetSource
 * @implements Source
 * @classdesc
 *
 * A {@link Source} that always provides the same {@link Asset}.
 *
 * @param {Asset} asset The asset.
*/
class SingleAssetSource {
  #asset: any;
  constructor(asset) {
    this.#asset = asset;
  }
  asset() {
    return this.#asset;
  }
  // TODO: _stage doesn't seem to be uesd here. Remove?
  loadAsset(_stage, tile, done) {
    var self = this;

    var timeout = setTimeout(function () {
      done(null, tile, self.#asset);
    }, 0);

    function cancel() {
      clearTimeout(timeout);
      done.apply(null, arguments);
    }

    return cancel;
  }
}

export default SingleAssetSource;
