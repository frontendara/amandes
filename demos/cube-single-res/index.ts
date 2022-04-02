/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  CubeGeometry,
  ImageUrlSource,
  RectilinearView,
  Viewer,
} from '../../src/index';

// Create viewer.
var viewer = new Viewer(document.getElementById('pano'));

// Create source.
var source = ImageUrlSource.fromString(
  '//www.marzipano.net/media/cubemap/{f}.jpg'
);

// Create geometry.
var geometry = new CubeGeometry([{ tileSize: 1024, size: 1024 }]);

// Create view.
var limiter = RectilinearView.limit.traditional(4096, (100 * Math.PI) / 180);
var view = new RectilinearView(null, limiter);

// Create scene.
var scene = viewer.createScene({
  source: source,
  geometry: geometry,
  view: view,
  pinFirstLevel: true,
});

// Display scene.
scene.switchTo();
