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
import eventEmitter from "minimal-event-emitter";
import Composer from "./Composer";
import clearOwnProperties from "../util/clearOwnProperties";
import RenderLoop from "../RenderLoop";

// TODO: this was probably got from window?
// @ts-ignore
var debug = typeof MARZIPANODEBUG !== "undefined" && MARZIPANODEBUG.controls;

/**
 * @class Controls
 * @classdesc
 *
 * Set of controls which affect a view (e.g. keyboard, touch)
 *
 * {@link ControlMethod} instances can be registered on this class. The methods
 * are then combined to calculate the final parameters to change the {@link View}.
 *
 * Controls is attached to a {@link RenderLoop}. Currently it affects the
 * {@link view} of all {@link Layer} on the {@link Stage} of the
 * {@link RenderLoop} it is attached to. A more flexible API may be provided
 * in the future.
 *
 * The ControlMethod instances are registered with an id and may be enabled,
 * disabled and unregistered using that id. The whole Control can also be
 * enabled or disabled.
 *
 */
class Controls {
  #methods: Record<string, any>;
  #methodGroups: any;
  #composer: any;
  #enabled: boolean;
  #activeCount: number;
  updatedViews_: any[];
  #attachedRenderLoop: any;
  #beforeRenderHandler?: (() => void) | null;
  #changeHandler?: (() => void) | null;

  constructor(opts?: { enabled?: any } | undefined) {
    opts = opts || {};

    this.#methods = {};
    this.#methodGroups = {};
    this.#composer = new Composer();

    // Whether the controls are enabled.
    this.#enabled = opts && opts.enabled ? !!opts.enabled : true;

    // How many control methods are enabled and in the active state.
    this.#activeCount = 0;

    this.updatedViews_ = [];

    this.#attachedRenderLoop = null;
  }
  /**
   * Destructor.
   */
  destroy() {
    this.detach();
    this.#composer.destroy();
    clearOwnProperties(this);
  }
  /**
   * @return {ControlMethod[]} List of registered @{link ControlMethod instances}
   */
  methods() {
    var obj = {};
    for (var id in this.#methods) {
      obj[id] = this.#methods[id];
    }
    return obj;
  }
  /**
   * @param {String} id
   * @return {ControlMethod}
   */
  method(id: string | number) {
    return this.#methods[id];
  }
  /**
   * @param {String} id
   * @param {ControlMethod} instance
   * @param {Boolean} [enable=false]
   */
  registerMethod(id: string, instance: any, enable?: any) {
    if (this.#methods[id]) {
      throw new Error("Control method already registered with id " + id);
    }

    this.#methods[id] = {
      instance: instance,
      enabled: false,
      active: false,
      activeHandler: this.#handleActive.bind(this, id),
      inactiveHandler: this.#handleInactive.bind(this, id),
    };

    if (enable) {
      this.enableMethod(id);
    }
  }
  /**
   * @param {String} id
   */
  unregisterMethod(id: string) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("No control method registered with id " + id);
    }
    if (method.enabled) {
      this.disableMethod(id);
    }
    delete this.#methods[id];
  }
  /**
   * @param {String} id
   */
  enableMethod(id: string) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("No control method registered with id " + id);
    }
    if (method.enabled) {
      return;
    }
    method.enabled = true;
    if (method.active) {
      this.#incrementActiveCount();
    }
    this.#listen(id);
    this.#updateComposer();
    // TODO: emitter types
    // @ts-ignore
    this.emit("methodEnabled", id);
  }
  /**
   * @param {String} id
   */
  disableMethod(id: string) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("No control method registered with id " + id);
    }
    if (!method.enabled) {
      return;
    }
    method.enabled = false;
    if (method.active) {
      this.#decrementActiveCount();
    }
    this.#unlisten(id);
    this.#updateComposer();
    this.emit("methodDisabled", id);
  }
  /**
   * Create a method group, which can be used to more conveniently enable or
   * disable several control methods at once
   * @param {String} groupId
   * @param {String[]} methodIds
   */
  addMethodGroup(groupId: string | number, methodIds: any) {
    this.#methodGroups[groupId] = methodIds;
  }
  /**
   * @param {String} groupId
   */
  removeMethodGroup(id: string | number) {
    delete this.#methodGroups[id];
  }
  /**
   * @return {ControlMethodGroup[]} List of control method groups
   */
  methodGroups() {
    var obj = {};
    for (var id in this.#methodGroups) {
      obj[id] = this.#methodGroups[id];
    }
    return obj;
  }
  /**
   * Enables all the control methods in the group
   * @param {String} groupId
   */
  enableMethodGroup(id: string | number) {
    var self = this;
    self.#methodGroups[id].forEach(function (methodId: string) {
      self.enableMethod(methodId);
    });
  }
  /**
   * Disables all the control methods in the group
   * @param {String} groupId
   */
  disableMethodGroup(id: string | number) {
    var self = this;
    self.#methodGroups[id].forEach(function (methodId: string) {
      self.disableMethod(methodId);
    });
  }
  /**
   * @returns {Boolean}
   */
  enabled() {
    return this.#enabled;
  }
  /**
   * Enables the controls
   */
  enable() {
    if (this.#enabled) {
      return;
    }
    this.#enabled = true;
    if (this.#activeCount > 0) {
      this.emit("active");
    }
    this.emit("enabled");
    this.#updateComposer();
  }
  /**
   * Disables the controls
   */
  disable() {
    if (!this.#enabled) {
      return;
    }
    this.#enabled = false;
    if (this.#activeCount > 0) {
      this.emit("inactive");
    }
    this.emit("disabled");
    this.#updateComposer();
  }
  emit(_arg0: string, _arg1?: any) {
    throw new Error("Method not implemented.");
  }
  /**
   * Attaches the controls to a {@link RenderLoop}. The RenderLoop will be woken
   * up when the controls are activated
   *
   * @param {RenderLoop}
   */
  attach(renderLoop: RenderLoop) {
    if (this.#attachedRenderLoop) {
      this.detach();
    }

    this.#attachedRenderLoop = renderLoop;
    this.#beforeRenderHandler = this.#updateViewsWithControls.bind(this);
    this.#changeHandler = renderLoop.renderOnNextFrame.bind(renderLoop);

    this.#attachedRenderLoop.addEventListener(
      "beforeRender",
      this.#beforeRenderHandler
    );
    this.#composer.addEventListener("change", this.#changeHandler);
  }
  /**
   * Detaches the controls
   */
  detach() {
    if (!this.#attachedRenderLoop) {
      return;
    }

    this.#attachedRenderLoop.removeEventListener(
      "beforeRender",
      this.#beforeRenderHandler
    );
    this.#composer.removeEventListener("change", this.#changeHandler);

    this.#beforeRenderHandler = null;
    this.#changeHandler = null;
    this.#attachedRenderLoop = null;
  }
  /**
   * @param {Boolean}
   */
  attached() {
    return this.#attachedRenderLoop != null;
  }
  #listen(id: string) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("Bad method id");
    }
    method.instance.addEventListener("active", method.activeHandler);
    method.instance.addEventListener("inactive", method.inactiveHandler);
  }
  #unlisten(id: string) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("Bad method id");
    }
    method.instance.removeEventListener("active", method.activeHandler);
    method.instance.removeEventListener("inactive", method.inactiveHandler);
  }
  #handleActive(id: string | number) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("Bad method id");
    }
    if (!method.enabled) {
      throw new Error("Should not receive event from disabled control method");
    }
    if (!method.active) {
      method.active = true;
      this.#incrementActiveCount();
    }
  }
  #handleInactive(id: string | number) {
    var method = this.#methods[id];
    if (!method) {
      throw new Error("Bad method id");
    }
    if (!method.enabled) {
      throw new Error("Should not receive event from disabled control method");
    }
    if (method.active) {
      method.active = false;
      this.#decrementActiveCount();
    }
  }
  #incrementActiveCount() {
    this.#activeCount++;
    if (debug) {
      this.#checkActiveCount();
    }
    if (this.#enabled && this.#activeCount === 1) {
      this.emit("active");
    }
  }
  #decrementActiveCount() {
    this.#activeCount--;
    if (debug) {
      this.#checkActiveCount();
    }
    if (this.#enabled && this.#activeCount === 0) {
      this.emit("inactive");
    }
  }
  #checkActiveCount() {
    var count = 0;
    for (var id in this.#methods) {
      var method = this.#methods[id];
      if (method.enabled && method.active) {
        count++;
      }
    }
    if (count != this.#activeCount) {
      throw new Error("Bad control state");
    }
  }
  #updateComposer() {
    var composer = this.#composer;

    for (var id in this.#methods) {
      var method = this.#methods[id];
      var enabled = this.#enabled && method.enabled;

      if (enabled && !composer.has(method.instance)) {
        composer.add(method.instance);
      }
      if (!enabled && composer.has(method.instance)) {
        composer.remove(method.instance);
      }
    }
  }
  #updateViewsWithControls() {
    var controlData = this.#composer.offsets();
    if (controlData.changing) {
      this.#attachedRenderLoop.renderOnNextFrame();
    }

    // Update each view at most once, even when shared by multiple layers.
    // The number of views is expected to be small, so use an array to keep track.
    this.updatedViews_.length = 0;

    var layers = this.#attachedRenderLoop.stage().listLayers();
    for (var i = 0; i < layers.length; i++) {
      var view = layers[i].view();
      if (this.updatedViews_.indexOf(view) < 0) {
        layers[i].view().updateWithControlParameters(controlData.offsets);
        this.updatedViews_.push(view);
      }
    }
  }
}

eventEmitter(Controls);

export default Controls;
