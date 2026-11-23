window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const module = { exports: {} };
    (function (module, exports) {
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ui/client.tsx
var client_exports = {};
__export(client_exports, {
  Launcher: () => Launcher,
  apply: () => apply,
  inject: () => inject,
  toggleWorkbench: () => toggleWorkbench
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var open = false;
var listeners = /* @__PURE__ */ new Set();
function toggleWorkbench(next) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}
function Launcher() {
  const [visible, setVisible] = (0, import_react.useState)(open);
  (0, import_react.useEffect)(() => {
    const fn = (v) => setVisible(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => toggleWorkbench(), style: {
      position: "absolute",
      right: 16,
      bottom: 16,
      zIndex: 40,
      padding: "8px 14px",
      borderRadius: 8,
      border: "1px solid #ccc",
      background: "#fff",
      cursor: "pointer"
    }, children: "\u5DE5\u4F5C\u53F0" }),
    visible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workbench, {})
  ] });
}
function Workbench() {
  const [ping, setPing] = (0, import_react.useState)("\u672A\u8FDE\u63A5");
  const probe = async () => {
    try {
      const r = await fetch("/novel/ping");
      setPing(JSON.stringify(await r.json()));
    } catch (e) {
      setPing(`\u5931\u8D25\uFF1A${e.message}`);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    position: "absolute",
    inset: 0,
    zIndex: 39,
    background: "rgba(255,255,255,0.98)",
    padding: 24,
    overflow: "auto"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { style: { marginTop: 0 }, children: [
      "\u5C0F\u8BF4\u5DE5\u4F5C\u53F0 ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => toggleWorkbench(false), style: { float: "right" }, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: probe, children: "\u6D4B\u8BD5 Host \u8FDE\u63A5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { marginTop: 12 }, children: ping })
  ] });
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register(
    { name: "shell.overlay", id: "novel-workbench-launcher", order: 20 },
    Launcher
  ));
}

    })(module, module.exports);
    return module.exports;
  },
});
