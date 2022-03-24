function prefixProperty(property: string) {
  if (typeof document === 'undefined') {
    return property;
  }

  var style = document.documentElement.style;
  var prefixList = ['Moz', 'Webkit', 'Khtml', 'O', 'ms'];

  for (var i = 0; i < prefixList.length; i++) {
    var prefix = prefixList[i];
    var capitalizedProperty = property[0].toUpperCase() + property.slice(1);
    var prefixedProperty = prefix + capitalizedProperty;

    if (prefixedProperty in style) {
      return prefixedProperty;
    }
  }

  return property;

}


function getWithVendorPrefix(property: string) {
  var prefixedProperty = prefixProperty(property);
  return function getPropertyWithVendorPrefix(element: { style: { [x: string]: any; }; }) {
    return element.style[prefixedProperty];
  };

}


function setWithVendorPrefix(property: string) {
  var prefixedProperty = prefixProperty(property);
  return function setPropertyWithVendorPrefix(element: { style: { [x: string]: any; }; }, val: any) {
    return (element.style[prefixedProperty] = val);
  };
}


var setTransform = setWithVendorPrefix('transform');
var setTransformOrigin = setWithVendorPrefix('transformOrigin');


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
  setNoPointerEvents
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
  setNoPointerEvents: setNoPointerEvents
};
