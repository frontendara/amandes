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
import cmp from "../util/cmp";
import Level from "./Level";

function makeLevelList(levelPropertiesList, LevelClass: typeof Level) {
  var list: any[] = [];

  for (var i = 0; i < levelPropertiesList.length; i++) {
    list.push(new LevelClass(levelPropertiesList[i]));
  }

  list.sort(function(level1, level2) {
    return cmp(level1.width(), level2.width());
  });

  return list;
}

function makeSelectableLevelList(levelList) {
  var list: unknown[] = [];

  for (var i = 0; i < levelList.length; i++) {
    // TODO: should this be using a getter
    if (!levelList[i].fallbackOnly()) {
      list.push(levelList[i]);
    }
  }

  if (!list.length) {
    throw new Error('No selectable levels in list');
  }

  return list;
}

// TODO: restructure these imports
export {
  makeLevelList,
  makeSelectableLevelList
};

export default {
  makeLevelList: makeLevelList,
  makeSelectableLevelList: makeSelectableLevelList
};
