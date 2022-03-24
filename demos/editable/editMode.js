import { dependencies } from "../../src/index";

class EditMode {
  constructor() {
    var self = this;

    this.shiftPressed = false;
    this.ctrlPressed = false;

    window.addEventListener("keydown", function (e) {
      var previousEditMode = self.get();
      if (e.keyCode === 16) {
        self.shiftPressed = true;
      }
      if (e.keyCode === 17) {
        self.ctrlPressed = true;
      }
      if (self.get() !== previousEditMode) {
        self.emit("changed");
      }
    });

    window.addEventListener("keyup", function (e) {
      var previousEditMode = self.get();
      if (e.keyCode === 16) {
        self.shiftPressed = false;
      }
      if (e.keyCode === 17) {
        self.ctrlPressed = false;
      }
      if (self.get() !== previousEditMode) {
        self.emit("changed");
      }
    });

    window.addEventListener("blur", function () {
      var previousEditMode = self.get();
      self.shiftPressed = false;
      self.ctrlPressed = false;
      if (self.get() !== previousEditMode) {
        self.emit("changed");
      }
    });
  }
  get() {
    if (this.shiftPressed) {
      return "hide";
    } else if (this.ctrlPressed) {
      return "show";
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
