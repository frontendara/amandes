// NullVideoElementWrapper is a wrapper around an HTML video element that simply
// exposes the underlying video element as the texture to be rendered, which is
// suitable for browsers that support WebGL video textures.
class NullVideoElementWrapper {
  constructor(videoElement) {
    this._videoElement = videoElement;
  }
  videoElement() {
    return this._videoElement;
  }
  drawElement() {
    return this._videoElement;
  }
  destroy() {
    // TODO: This cleanup logic should be somewhere else, since the analogous
    // setup logic occurs outside this class.
    this._videoElement.pause();
    this._videoElement.volume = 0;
    this._videoElement.removeAttribute('src');
  }
}

export default NullVideoElementWrapper;