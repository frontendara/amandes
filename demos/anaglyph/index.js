import { Viewer, CubeGeometry, ImageUrlSource, TextureStore, Layer, RectilinearView } from '../../src/index'
import { colorTransformEffects } from './colorTransformEffects.js';

// Create viewer.
var viewer = new Viewer(document.getElementById('pano'));

// Create geometry.
var geometry = new CubeGeometry([
  { tileSize: 256, size: 256, fallbackOnly: true },
  { tileSize: 512, size: 512 },
  { tileSize: 512, size: 1024 },
  { tileSize: 512, size: 2048 },
  { tileSize: 512, size: 4096 }
]);

// Create view.
// The view is shared by the two layers.
var viewLimiter = RectilinearView.limit.traditional(3100, 100*Math.PI/180);
var view = new RectilinearView(null, viewLimiter);

// Get the stage.
var stage = viewer.stage();

// Create the left and right images.
var left = createLayer(stage, view, geometry, 'left');
var right = createLayer(stage, view, geometry, 'right');

// Add layers into the stage.
// The left image must be rendered on top of the right image.
// See colorTransformEffects.js for an explanation.
stage.addLayer(right);
stage.addLayer(left);

function createLayer(stage, view, geometry, eye) {
  // Create the source.
  var urlPrefix = "//www.net/media/music-room";
  var source = ImageUrlSource.fromString(
    urlPrefix + "/" + eye + "/{z}/{f}/{y}/{x}.jpg",
    { cubeMapPreviewUrl: urlPrefix + "/" + eye + "/preview.jpg" });

  // Create the texture store.
  var textureStore = new TextureStore(source, stage);

  // Create the layer.
  var layer = new Layer(source, geometry, view, textureStore);

  layer.pinFirstLevel();

  return layer;
}

// Update the effects to match the chosen anaglyph type.
var typeElement = document.getElementById('type');
function updateEffects() {
  var type = typeElement.value;
  var effects = colorTransformEffects[type]();
  left.setEffects(effects.left);
  right.setEffects(effects.right);
}
updateEffects();
typeElement.addEventListener('change', updateEffects);
