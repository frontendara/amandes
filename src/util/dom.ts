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

function prefixProperty(property: string) {
  if (typeof document === 'undefined') {
    return property;
  }

  const style = document.documentElement.style;
  const prefixList = ['Moz', 'Webkit', 'Khtml', 'O', 'ms'];

  for (let i = 0; i < prefixList.length; i++) {
    const prefix = prefixList[i];
    const capitalizedProperty = property[0].toUpperCase() + property.slice(1);
    const prefixedProperty = prefix + capitalizedProperty;

    if (prefixedProperty in style) {
      return prefixedProperty;
    }
  }

  return property;
}

function getWithVendorPrefix(property: string) {
  const prefixedProperty = prefixProperty(property);
  return function getPropertyWithVendorPrefix(element: {
    style: { [x: string]: any };
  }) {
    return element.style[prefixedProperty];
  };
}

function setWithVendorPrefix(property: string) {
  const prefixedProperty = prefixProperty(property);
  return function setPropertyWithVendorPrefix(
    element: { style: { [x: string]: any } },
    val: any
  ) {
    return (element.style[prefixedProperty] = val);
  };
}

const setTransform = setWithVendorPrefix('transform');
const setTransformOrigin = setWithVendorPrefix('transformOrigin');

function setNullTransform(element: HTMLElement) {
  setTransform(element, 'translateZ(0)');
}

function setNullTransformOrigin(element: HTMLElement) {
  setTransformOrigin(element, '0 0 0');
}

function setAbsolute(element: HTMLElement) {
  element.style.position = 'absolute';
}

function setPixelPosition(element: HTMLElement, x: string, y: string) {
  element.style.left = x + 'px';
  element.style.top = y + 'px';
}

function setPixelSize(element: HTMLElement, width: number, height: number) {
  element.style.width = width + 'px';
  element.style.height = height + 'px';
}

function setNullSize(element: HTMLElement) {
  element.style.width = element.style.height = '0';
}

function setFullSize(element: HTMLElement) {
  element.style.width = element.style.height = '100%';
}

function setOverflowHidden(element: HTMLElement) {
  element.style.overflow = 'hidden';
}

function setOverflowVisible(element: HTMLElement) {
  element.style.overflow = 'visible';
}

function setNoPointerEvents(element: HTMLElement) {
  element.style.pointerEvents = 'none';
}

// TODO: rethink these exports
export {
  prefixProperty,
  getWithVendorPrefix,
  setWithVendorPrefix,
  setTransform,
  setTransformOrigin,
  setNullTransform,
  setNullTransformOrigin,
  setAbsolute,
  setPixelPosition,
  setPixelSize,
  setNullSize,
  setFullSize,
  setOverflowHidden,
  setOverflowVisible,
  setNoPointerEvents,
};

export default {
  prefixProperty: prefixProperty,
  getWithVendorPrefix: getWithVendorPrefix,
  setWithVendorPrefix: setWithVendorPrefix,
  setTransform: setTransform,
  setTransformOrigin: setTransformOrigin,
  setNullTransform: setNullTransform,
  setNullTransformOrigin: setNullTransformOrigin,
  setAbsolute: setAbsolute,
  setPixelPosition: setPixelPosition,
  setPixelSize: setPixelSize,
  setNullSize: setNullSize,
  setFullSize: setFullSize,
  setOverflowHidden: setOverflowHidden,
  setOverflowVisible: setOverflowVisible,
  setNoPointerEvents: setNoPointerEvents,
};
