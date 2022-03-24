// CanvasHackVideoElementWrapper is a wrapper around an HTML video element that
// copies each video frame into an HTML canvas element for rendering. This is a
// workaround for IE 11, which doesn't support WebGL video textures. Note,
// however, that the workaround won't work if the video is cross-domain. See:
// https://connect.microsoft.com/IE/feedbackdetail/view/941984/webgl-video-upload-to-texture-not-supported
// https://connect.microsoft.com/IE/feedback/details/967946/support-crossorigin-cors-for-drawing-video-to-canvas-both-2d-and-webgl
class CanvasHackVideoElementWrapper {
  constructor(videoElement) {
    this._videoElement = videoElement;
    this._drawElement = document.createElement('canvas');
  }
  videoElement() {
    return this._videoElement;
  }
  drawElement() {
    this._drawElement.width = this._videoElement.videoWidth;
    this._drawElement.height = this._videoElement.videoHeight;
    this._drawElement.getContext("2d").drawImage(this._videoElement, 0, 0);
    return this._drawElement;
  }
  destroy() {
    // TODO: This cleanup logic should be somewhere else, since the analogous
    // setup logic occurs outside this class.
    this._videoElement.pause();
    this._videoElement.volume = 0;
    this._videoElement.removeAttribute('src');
  }
}

export default CanvasHackVideoElementWrapper;
