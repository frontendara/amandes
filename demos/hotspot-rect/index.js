import * as Marzipano from '../../src/index';

var rects = [
  null,
  { relativeWidth: 0.6, relativeHeight: 0.3, relativeX: 0.6 },
  { relativeWidth: 0.6, relativeHeight: 0.7, relativeX: 0.4, relativeY: 0.3 }
];

// Create viewer.
var viewer = new Marzipano.Viewer(document.querySelector('#pano'));

// Get the stage.
var stage = viewer.stage();

// Create source.
var source = Marzipano.ImageUrlSource.fromString(
  "//www.marzipano.net/media/cubemap/{f}.jpg"
);

// Create geometry.
var geometry = new Marzipano.CubeGeometry([{ tileSize: 1024, size: 1024 }]);

// Create view limiter.
var limiter = Marzipano.RectilinearView.limit.traditional(1024, 100*Math.PI/180);

// Create layers with different `rect` parameters and with hotspots.
var marzipanoObjects = rects.map(function(rect) {
  // Create layer.
  var view = new Marzipano.RectilinearView(null);
  var textureStore = new Marzipano.TextureStore(source, stage);
  var layer = new Marzipano.Layer(source, geometry, view, textureStore, { effects: { rect: rect }});

  // Add hotspot.
  var hotspotContainer = new Marzipano.HotspotContainer(viewer.domElement(), stage, view, viewer.renderLoop(), { rect: rect });
  var hotspotElement = document.createElement('div');
  hotspotElement.className = 'hotspot';
  var hotspot = hotspotContainer.createHotspot(hotspotElement, { yaw: 0.1, pitch: -0.3 });

  // Add layer into stage.
  stage.addLayer(layer);

  return { layer: layer, hotspotContainer: hotspotContainer, hotspot: hotspot}
});
