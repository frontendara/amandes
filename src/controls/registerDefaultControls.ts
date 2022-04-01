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
import defaults from '../util/defaults';
import DragControlMethod from './Drag';
import QtvrControlMethod from './Qtvr';
import ScrollZoomControlMethod from './ScrollZoom';
import PinchZoomControlMethod from './PinchZoom';
import KeyControlMethod from './Key';
import Controls from './Controls';

const defaultOptions = {
  mouseViewMode: 'drag',
  dragMode: 'pan',
};

interface RegisterDefaultControlsOptions {
  mouseViewMode?: 'drag' | 'qtvr';
  dragMode?: 'pan' | 'pinch';
  scrollZoom?: boolean;
}

/**
 * Instantiate and register some commonly used {@link ControlMethod} instances.
 *
 * The following instances are registered:
 *   - mouseViewDrag
 *   - mouseViewQtvr
 *   - touchView
 *   - pinch
 *   - arrowKeys
 *   - plusMinusKeys
 *   - wasdKeys
 *   - qeKeys
 *
 * @param {Controls} controls Where to register the instances.
 * @param {Element} element Element to listen for events.
 * @param {'drag'|'qtvr'} opts.mouseViewMode
 * @param {'pan'|'pinch'} opts.dragMode
 * @param {boolean} opts.scrollZoom
 */
function registerDefaultControls(
  controls: Controls,
  element: Element,
  opts?: RegisterDefaultControlsOptions
) {
  opts = defaults(opts || {}, defaultOptions) as RegisterDefaultControlsOptions;

  const controlMethods: Record<string, any> = {
    mouseViewDrag: new DragControlMethod(element, 'mouse'),
    mouseViewQtvr: new QtvrControlMethod(element, 'mouse'),

    leftArrowKey: new KeyControlMethod(37, 'x', -0.7, 3),
    rightArrowKey: new KeyControlMethod(39, 'x', 0.7, 3),
    upArrowKey: new KeyControlMethod(38, 'y', -0.7, 3),
    downArrowKey: new KeyControlMethod(40, 'y', 0.7, 3),
    plusKey: new KeyControlMethod(107, 'zoom', -0.7, 3),
    minusKey: new KeyControlMethod(109, 'zoom', 0.7, 3),

    wKey: new KeyControlMethod(87, 'y', -0.7, 3),
    aKey: new KeyControlMethod(65, 'x', -0.7, 3),
    sKey: new KeyControlMethod(83, 'y', 0.7, 3),
    dKey: new KeyControlMethod(68, 'x', 0.7, 3),
    qKey: new KeyControlMethod(81, 'roll', 0.7, 3),
    eKey: new KeyControlMethod(69, 'roll', -0.7, 3),
  };

  const enabledControls = ['scrollZoom', 'touchView', 'pinch'];

  if (opts.scrollZoom !== false) {
    controlMethods.scrollZoom = new ScrollZoomControlMethod(element); //{ frictionTime: 0 }
  }

  const controlMethodGroups = {
    arrowKeys: ['leftArrowKey', 'rightArrowKey', 'upArrowKey', 'downArrowKey'],
    plusMinusKeys: ['plusKey', 'minusKey'],
    wasdKeys: ['wKey', 'aKey', 'sKey', 'dKey'],
    qeKeys: ['qKey', 'eKey'],
  };

  switch (opts.dragMode) {
    case 'pinch':
      controlMethods.pinch = new DragControlMethod(element, 'touch', {
        hammerEvent: 'pinch',
      });
      break;
    case 'pan':
      controlMethods.touchView = new DragControlMethod(element, 'touch');
      controlMethods.pinch = new PinchZoomControlMethod(element, 'touch');
      break;
    default:
      throw new Error('Unknown drag mode: ' + opts.dragMode);
  }

  switch (opts.mouseViewMode) {
    case 'drag':
      enabledControls.push('mouseViewDrag');
      break;
    case 'qtvr':
      enabledControls.push('mouseViewQtvr');
      break;
    default:
      throw new Error('Unknown mouse view mode: ' + opts.mouseViewMode);
  }

  for (const id in controlMethods) {
    const method = controlMethods[id];
    controls.registerMethod(id, method);
    if (enabledControls.indexOf(id) >= 0) {
      controls.enableMethod(id);
    }
  }

  for (const groupId in controlMethodGroups) {
    const methodGroup = controlMethodGroups[groupId] as string[];
    controls.addMethodGroup(groupId, methodGroup);
  }

  return controlMethods;
}

export default registerDefaultControls;
