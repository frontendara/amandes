import { CubeGeometry, ImageUrlSource, RectilinearView, Viewer } from '../../src/index';
import DeviceOrientationControlMethod from './DeviceOrientationControlMethod.js';

// Create viewer.
var viewer = new Viewer(document.getElementById('pano'));

// Register the custom control method.
var deviceOrientationControlMethod = new DeviceOrientationControlMethod();
var controls = viewer.controls();
controls.registerMethod('deviceOrientation', deviceOrientationControlMethod);

// Create source.
var source = ImageUrlSource.fromString(
  "//www.marzipano.net/media/cubemap/{f}.jpg"
);

// Create geometry.
var geometry = new CubeGeometry([{ tileSize: 1024, size: 1024 }]);

// Create view.
var limiter = RectilinearView.limit.traditional(1024, 100 * Math.PI / 180);
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

// Set up control for enabling/disabling device orientation.

var enabled = false;

var toggleElement = document.getElementById('toggleDeviceOrientation');

function requestPermissionForIOS() {
  window.DeviceOrientationEvent.requestPermission()
    .then(response => {
      if (response === 'granted') {
        enableDeviceOrientation()
      }
    }).catch((e) => {
      console.error(e)
    })
}

function enableDeviceOrientation() {
  deviceOrientationControlMethod.getPitch(function (err, pitch) {
    if (!err) {
      view.setPitch(pitch);
    }
  });
  controls.enableMethod('deviceOrientation');
  enabled = true;
  toggleElement.className = 'enabled';
}

function enable() {
  if (window.DeviceOrientationEvent) {
    if (typeof (window.DeviceOrientationEvent.requestPermission) == 'function') {
      requestPermissionForIOS()
    } else {
      enableDeviceOrientation()
    }
  }
}

function disable() {
  controls.disableMethod('deviceOrientation');
  enabled = false;
  toggleElement.className = '';
}

function toggle() {
  if (enabled) {
    disable();
  } else {
    enable();
  }
}

toggleElement.addEventListener('click', toggle);
