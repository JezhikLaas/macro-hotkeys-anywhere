import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROBLEMS, SOURCES } from "../scripts/constants.mjs";
import { HotkeyMath } from "../scripts/hotkeys/hotkey-math.mjs";

const hotkey = (id, macroUuid, key, mods = {}) => ({ id, macroUuid, key, ctrl: false, alt: false, shift: false, ...mods });

describe("HotkeyMath.fromEvent", () => {
  it("reads code and modifiers; Meta counts as Ctrl", () => {
    assert.deepEqual(HotkeyMath.fromEvent({ code: "KeyR", ctrlKey: true, shiftKey: true }), {
      key: "KeyR", ctrl: true, alt: false, shift: true
    });
    assert.equal(HotkeyMath.fromEvent({ code: "KeyR", metaKey: true }).ctrl, true);
  });
  it("ignores modifier keys alone", () => {
    for (const code of ["ShiftLeft", "ControlRight", "AltLeft", "MetaLeft", "CapsLock"]) {
      assert.equal(HotkeyMath.fromEvent({ code, shiftKey: true }), null, code);
    }
  });
  it("ignores IME composition and missing codes", () => {
    assert.equal(HotkeyMath.fromEvent({ code: "KeyA", isComposing: true }), null);
    assert.equal(HotkeyMath.fromEvent({ code: "" }), null);
    assert.equal(HotkeyMath.fromEvent(null), null);
  });
  it("ignores AltGr, which Windows reports as Ctrl+Alt", () => {
    const event = { code: "KeyQ", ctrlKey: true, altKey: true, getModifierState: k => k === "AltGraph" };
    assert.equal(HotkeyMath.fromEvent(event), null);
  });
  it("accepts real Ctrl+Alt without AltGr", () => {
    const event = { code: "KeyQ", ctrlKey: true, altKey: true, getModifierState: () => false };
    assert.deepEqual(HotkeyMath.fromEvent(event), { key: "KeyQ", ctrl: true, alt: true, shift: false });
  });
});

describe("HotkeyMath.comboId", () => {
  it("orders modifiers canonically", () => {
    assert.equal(HotkeyMath.comboId({ key: "KeyR", shift: true, ctrl: true, alt: true }), "Control+Alt+Shift+KeyR");
    assert.equal(HotkeyMath.comboId({ key: "F2" }), "F2");
  });
  it("is empty without a key", () => {
    assert.equal(HotkeyMath.comboId({ key: "", ctrl: true }), "");
  });
});

describe("HotkeyMath.normalize", () => {
  it("fills missing fields and coerces types", () => {
    assert.deepEqual(HotkeyMath.normalize({ macroUuid: " Macro.abc ", ctrl: 1 }), {
      id: "", macroUuid: "Macro.abc", key: "", ctrl: true, alt: false, shift: false
    });
  });
});

describe("HotkeyMath.validate", () => {
  it("accepts Ctrl or Alt combinations and bare function keys", () => {
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "KeyR", { ctrl: true })), null);
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "Digit1", { alt: true })), null);
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "F2")), null);
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "F24", { shift: true })), null);
  });
  it("refuses keys that would break typing", () => {
    for (const key of ["KeyR", "Digit1", "Enter", "ArrowUp", "Space", "Backspace"]) {
      assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", key)), PROBLEMS.NEEDS_MODIFIER, key);
    }
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "KeyR", { shift: true })), PROBLEMS.NEEDS_MODIFIER);
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "F25")), PROBLEMS.NEEDS_MODIFIER);
  });
  it("reports missing key before missing macro", () => {
    assert.equal(HotkeyMath.validate(hotkey("a", "", "")), PROBLEMS.NO_KEY);
    assert.equal(HotkeyMath.validate(hotkey("a", "", "F2")), PROBLEMS.NO_MACRO);
  });
  it("refuses protected keys in any combination", () => {
    const options = { protectedKeys: ["F5", "F12"] };
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "F5"), options), PROBLEMS.PROTECTED);
    assert.equal(HotkeyMath.validate(hotkey("a", "Macro.x", "F12", { ctrl: true }), options), PROBLEMS.PROTECTED);
  });
});

describe("HotkeyMath.duplicates", () => {
  it("reports every hotkey of a repeated combination", () => {
    const list = [
      hotkey("a", "Macro.1", "KeyR", { ctrl: true }),
      hotkey("b", "Macro.2", "KeyR", { ctrl: true }),
      hotkey("c", "Macro.3", "KeyR", { ctrl: true, shift: true }),
      hotkey("d", "Macro.4", "")
    ];
    assert.deepEqual([...HotkeyMath.duplicates(list)].sort(), ["a", "b"]);
  });
});

describe("HotkeyMath.merge", () => {
  const world = [
    hotkey("w1", "Macro.world1", "KeyR", { ctrl: true }),
    hotkey("w2", "Macro.world2", "F2"),
    hotkey("w3", "Macro.bad", "KeyX")
  ];
  const user = [hotkey("u1", "Macro.mine", "KeyR", { ctrl: true }), hotkey("u2", "", "F3")];

  it("lets user hotkeys win over world hotkeys", () => {
    const active = HotkeyMath.merge(world, user);
    assert.equal(active.get("Control+KeyR").hotkey.macroUuid, "Macro.mine");
    assert.equal(active.get("Control+KeyR").source, SOURCES.USER);
    assert.equal(active.get("F2").source, SOURCES.WORLD);
  });
  it("skips invalid and incomplete hotkeys", () => {
    const active = HotkeyMath.merge(world, user);
    assert.equal(active.has("KeyX"), false);
    assert.equal(active.has("F3"), false);
    assert.equal(active.size, 2);
  });
  it("keeps the first of duplicates within a list", () => {
    const active = HotkeyMath.merge([hotkey("a", "Macro.1", "F4"), hotkey("b", "Macro.2", "F4")], []);
    assert.equal(active.get("F4").hotkey.id, "a");
  });
  it("tolerates missing lists", () => {
    assert.equal(HotkeyMath.merge(undefined, null).size, 0);
  });
});

describe("HotkeyMath.format", () => {
  it("formats with default labels", () => {
    assert.equal(HotkeyMath.format({ key: "KeyR", ctrl: true, shift: true }), "Ctrl + Shift + R");
    assert.equal(HotkeyMath.format({ key: "Numpad5", alt: true }), "Alt + Num 5");
    assert.equal(HotkeyMath.format({ key: "F2" }), "F2");
    assert.equal(HotkeyMath.format({ key: "" }), "");
  });
  it("uses the given labels", () => {
    const labels = { ctrl: "Strg", shift: "Umschalt", key: code => `<${code}>` };
    assert.equal(HotkeyMath.format({ key: "KeyR", ctrl: true, shift: true }, labels), "Strg + Umschalt + <KeyR>");
  });
});
