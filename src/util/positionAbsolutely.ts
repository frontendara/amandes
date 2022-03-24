import { setTransform as setTransform } from "./dom";
import decimal from "./decimal";

function positionAbsolutely(
  element: { style: { [x: string]: any } },
  x: number,
  y: number,
  extraTransforms?: string
) {
  extraTransforms = extraTransforms || "";
  // A translateZ(0) transform improves performance on Chrome by creating a
  // new layer for the element, which prevents unnecessary repaints.
  var transform =
    "translateX(" +
    decimal(x) +
    "px) translateY(" +
    decimal(y) +
    "px) translateZ(0) " +
    extraTransforms;
  setTransform(element, transform);
}

export default positionAbsolutely;
