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
function maxFriction(friction: number, velocityX: number, velocityY: number, maxFrictionTime: number, result: [number, number] | [null, null]) {
  const velocity = Math.sqrt(Math.pow(velocityX,2) + Math.pow(velocityY,2));
  friction = Math.max(friction, velocity/maxFrictionTime);
  changeVectorNorm(velocityX, velocityY, friction, result);
  result[0] = Math.abs(Number(result[0]));
  result[1] = Math.abs(Number(result[1]));
}

function changeVectorNorm(x: number, y: number, n: number, result: null[] | number[]) {
  const theta = Math.atan(y/x);
  result[0] = n * Math.cos(theta);
  result[1] = n * Math.sin(theta);
}

// TODO: restructure these imports
export {
  maxFriction,
  changeVectorNorm
};
