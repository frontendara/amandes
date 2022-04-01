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
import defaults from "../util/defaults";
import clearOwnProperties from "../util/clearOwnProperties";

const defaultOpts = {
  active: 'move',
  inactive: 'default',
  disabled: 'default'
};

/**
 * @class ControlCursor
 * @classdesc
 *
 * Sets the CSS cursor on a DOM element according to the state of a
 * {@link ControlMethod}.
 *
 * @param {Controls} controls Controls instance containing the control method.
 * @param {string} id ID of the control method.
 * @param {Element} element DOM element where the cursor should be set.
 * @param {Object} opts The control cursors. Each field must be a valid value
 *     for the `cursor` CSS property.
 * @param {string} [opts.active='move'] Cursor to set when the control method
 *     is enabled and active.
 * @param {string} [opts.inactive='default'] Cursor to set when the control
 *     method is enabled and inactive.
 * @param {string} [opts.disabled='default'] Cursor to set when the control
 *     method is disabled.
 */
class ControlCursor {
  #element: any;
  #controls: any;
  #id: any;
  #attached: boolean;
  #setActiveCursor: () => void;
  #setInactiveCursor: () => void;
  #setDisabledCursor: () => void;
  #setOriginalCursor: () => void;
  #updateAttachmentHandler: () => void;
  constructor(controls, id, element, opts) {
    opts = defaults(opts || {}, defaultOpts);

    // TODO: This class may misbehave if the control method is unregistered and a
    // different control method is registered under the same id.
    this.#element = element;
    this.#controls = controls;
    this.#id = id;

    this.#attached = false;

    this.#setActiveCursor = this.#setCursor.bind(this, opts.active);
    this.#setInactiveCursor = this.#setCursor.bind(this, opts.inactive);
    this.#setDisabledCursor = this.#setCursor.bind(this, opts.disabled);
    this.#setOriginalCursor = this.#setCursor.bind(this, this.#element.style.cursor);

    this.#updateAttachmentHandler = this.#updateAttachment.bind(this);

    controls.addEventListener('methodEnabled', this.#updateAttachmentHandler);
    controls.addEventListener('methodDisabled', this.#updateAttachmentHandler);
    controls.addEventListener('enabled', this.#updateAttachmentHandler);
    controls.addEventListener('disabled', this.#updateAttachmentHandler);

    this.#updateAttachment();
  }
  /**
   * Destructor.
   */
  destroy() {
    this.#detachFromControlMethod(this.#controls.method(this.#id));
    this.#setOriginalCursor();

    this.#controls.removeEventListener('methodEnabled',
      this.#updateAttachmentHandler);
    this.#controls.removeEventListener('methodDisabled',
      this.#updateAttachmentHandler);
    this.#controls.removeEventListener('enabled',
      this.#updateAttachmentHandler);
    this.#controls.removeEventListener('disabled',
      this.#updateAttachmentHandler);

    clearOwnProperties(this);
  }
  #updateAttachment() {
    const controls = this.#controls;
    const id = this.#id;
    if (controls.enabled() && controls.method(id).enabled) {
      this.#attachToControlMethod(controls.method(id));
    } else {
      this.#detachFromControlMethod(controls.method(id));
    }
  }
  #attachToControlMethod(controlMethod) {
    if (!this.#attached) {
      controlMethod.instance.addEventListener('active', this.#setActiveCursor);
      controlMethod.instance.addEventListener('inactive', this.#setInactiveCursor);

      if (controlMethod.active) {
        this.#setActiveCursor();
      } else {
        this.#setInactiveCursor();
      }

      this.#attached = true;
    }
  }
  #detachFromControlMethod(controlMethod) {
    if (this.#attached) {
      controlMethod.instance.removeEventListener('active', this.#setActiveCursor);
      controlMethod.instance.removeEventListener('inactive', this.#setInactiveCursor);

      this.#setDisabledCursor();

      this.#attached = false;
    }
  }
  #setCursor(cursor) {
    this.#element.style.cursor = cursor;
  }
}

export default ControlCursor;
