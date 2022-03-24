import * as Marzipano from '../../src/index';
import { colorEffects } from './colorEffects.js';

export function createEditableLayers(stage, url, done) {
  urlToCanvas(url, function(err, colorCanvas) {
    if (err) {
      done(err);
      return;
    }

    // Make a desaturated copy of the canvas.
    var bwCanvas = desaturateCanvas(colorCanvas);

    // Create common geometry and view.
    var geometry = new Marzipano.EquirectGeometry([{ width: colorCanvas.width }]);
    var limiter = Marzipano.RectilinearView.limit.traditional(colorCanvas.width/4 * 1.5, 100*Math.PI/180);
    var view = new Marzipano.RectilinearView(null, limiter);

    // Create color layer.
    var colorAsset = new Marzipano.DynamicAsset(colorCanvas);
    var colorSource = new Marzipano.SingleAssetSource(colorAsset);
    var colorTextureStore = new Marzipano.TextureStore(colorSource, stage);
    var colorLayer = new Marzipano.Layer(colorSource, geometry, view, colorTextureStore);

    // Create desaturated layer.
    var bwAsset = new Marzipano.DynamicAsset(bwCanvas);
    var bwSource = new Marzipano.SingleAssetSource(bwAsset);
    var bwTextureStore = new Marzipano.TextureStore(bwSource, stage);
    var bwLayer = new Marzipano.Layer(bwSource, geometry, view, bwTextureStore);

    done(null, {
      colorLayer: colorLayer,
      bwLayer: bwLayer
    });
  });
}

function urlToCanvas(url, done) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var img = new Image();
  img.onload = function() {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    done(null, canvas);
  };
  img.onerror = function(e) {
    done(e);
  };
  img.crossOrigin = 'anonymous';
  img.src = url;
}

function desaturateCanvas(original) {
  var canvas = document.createElement('canvas');
  canvas.width = original.width;
  canvas.height = original.height;
  var ctx = canvas.getContext('2d');
  var imageData = original.getContext('2d').getImageData(0, 0, original.width, original.height);
  Marzipano.colorEffects.applyToImageData(imageData, colorEffects.saturation(0));
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
