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
import { dependencies } from '../../src/index';

class EditMode {
  constructor() {
    var self = this;

    this.shiftPressed = false;
    this.ctrlPressed = false;

    window.addEventListener('keydown', function (e) {
      var previousEditMode = self.get();
      if (e.keyCode === 16) {
        self.shiftPressed = true;
      }
      if (e.keyCode === 17) {
        self.ctrlPressed = true;
      }
      if (self.get() !== previousEditMode) {
        self.emit('changed');
      }
    });

    window.addEventListener('keyup', function (e) {
      var previousEditMode = self.get();
      if (e.keyCode === 16) {
        self.shiftPressed = false;
      }
      if (e.keyCode === 17) {
        self.ctrlPressed = false;
      }
      if (self.get() !== previousEditMode) {
        self.emit('changed');
      }
    });

    window.addEventListener('blur', function () {
      var previousEditMode = self.get();
      self.shiftPressed = false;
      self.ctrlPressed = false;
      if (self.get() !== previousEditMode) {
        self.emit('changed');
      }
    });
  }
  get() {
    if (this.shiftPressed) {
      return 'hide';
    } else if (this.ctrlPressed) {
      return 'show';
    } else {
      return false;
    }
  }
}

dependencies.eventEmitter(EditMode);

let editMode;
if (!editMode) {
  editMode = new EditMode();
}

export { editMode };
