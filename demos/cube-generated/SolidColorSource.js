import { StaticAsset } from '../../src/index';

// Custom tile source for procedurally generated solid color tiles.
class SolidColorSource {
  constructor(width, height) {
    this._width = width;
    this._height = height;
  }
  _tileText(tile) {
    var components = [];
    if (tile.face) {
      components.push("face:" + tile.face);
    }
    components.push("x:" + tile.x);
    components.push("y:" + tile.y);
    components.push("zoom:" + tile.z);
    return components.join(" ");
  }
  _tileColor(tile) {
    switch (tile.face) {
      case 'u': return "#999";
      case 'b': return "#aaa";
      case 'd': return "#bbb";
      case 'f': return "#ccc";
      case 'r': return "#ddd";
      case 'l': return "#eee";
      default: return "#ddd";
    }
  }
  loadAsset(stage, tile, done) {
    var width = this._width;
    var height = this._height;
    var text = this._tileText(tile);
    var color = this._tileColor(tile);

    // Create the canvas element.
    var element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    var ctx = element.getContext("2d");

    // Draw tile background.
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // Draw tile border.
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(0, 0, width, height);

    // Draw tile text.
    ctx.fillStyle = "#000";
    ctx.font = width / 20 + "px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, width / 2, height / 2);

    // Pass result into callback.
    var timeout = setTimeout(function () {
      var asset = new StaticAsset(element);
      done(null, tile, asset);
    }, 0);

    // Return a cancelable.
    // See src/util/cancelize.js for an explanation of how cancelables work.
    return function cancel() {
      clearTimeout(timeout);
      done.apply(null, arguments);
    };
  }
}

export default SolidColorSource;