import { CubeGeometry, ImageUrlSource, RectilinearView, Viewer } from '../../src/index';

// Create viewer.
var viewer = new Viewer(document.getElementById('pano'));

// Create source.
var source = ImageUrlSource.fromString(
  "//www.marzipano.net/media/cubemap/{f}.jpg"
);

// Create geometry.
var geometry = new CubeGeometry([{ tileSize: 1024, size: 1024 }]);

// Create view.
var limiter = RectilinearView.limit.traditional(4096, 100*Math.PI/180);
var view = new RectilinearView(null, limiter);

// Create scene.
var scene = viewer.createScene({
  source: source,
  geometry: geometry,
  view: view,
  pinFirstLevel: true
});

// Display scene.
scene.switchTo();
