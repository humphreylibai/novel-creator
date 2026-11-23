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
var import_react3 = require("react");

// src/ui/App.tsx
var import_react2 = require("react");

// src/ui/api.ts
async function j(path, init) {
  const res = await fetch(`/novel${path}`, { headers: { "content-type": "application/json" }, ...init });
  if (res.status === 204) return void 0;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}
var listWorlds = () => j("/worlds");
var listNodes = (w) => j(`/worlds/${encodeURIComponent(w)}/nodes`);
var readNode = (w, id) => j(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);
var saveNode = (w, n) => j(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(String(n["id"]))}`, {
  method: "PUT",
  body: JSON.stringify(n)
});

// src/ui/views/NodeEditor.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function NodeEditor({ world, node, onSaved }) {
  const [title, setTitle] = (0, import_react.useState)(String(node["title"] ?? ""));
  const [body, setBody] = (0, import_react.useState)(String(node["body"] ?? ""));
  const [error, setError] = (0, import_react.useState)(null);
  const [saving, setSaving] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    setTitle(String(node["title"] ?? ""));
    setBody(String(node["body"] ?? ""));
    setError(null);
  }, [node]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveNode(world, { ...node, title, body });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  const id = String(node["id"] ?? "");
  const isAxiom = node["kind"] === "axiom";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 20, display: "flex", flexDirection: "column", gap: 10, minHeight: "100%", boxSizing: "border-box" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { style: { margin: 0, fontSize: 16 }, children: [
        isAxiom ? "\u516C\u7406" : "\u6761\u76EE",
        "\u7F16\u8F91\u5668"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "#a8a29a" }, children: id }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void save(), disabled: saving, style: {
        padding: "6px 16px",
        borderRadius: 6,
        border: "1px solid #b45309",
        background: saving ? "#e7e2da" : "#b45309",
        color: saving ? "#a8a29a" : "#fff",
        cursor: saving ? "wait" : "pointer"
      }, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        value: title,
        onChange: (e) => setTitle(e.target.value),
        placeholder: "\u6807\u9898",
        style: { padding: "8px 10px", fontSize: 15, border: "1px solid #e7e2da", borderRadius: 6 }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "textarea",
      {
        value: body,
        onChange: (e) => setBody(e.target.value),
        placeholder: "\u6B63\u6587",
        style: {
          flex: 1,
          minHeight: 260,
          padding: "10px 12px",
          fontSize: 14,
          lineHeight: 1.7,
          border: "1px solid #e7e2da",
          borderRadius: 6,
          resize: "vertical",
          fontFamily: "inherit"
        }
      }
    ),
    error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "alert", style: {
      padding: "8px 10px",
      borderRadius: 6,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#b91c1c",
      whiteSpace: "pre-wrap"
    }, children: error }) : null
  ] });
}

// src/ui/views/StagePlaceholder.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function StagePlaceholder({ title, reason }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { padding: 32, color: "#a8a29a" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: "0 0 8px", fontSize: 18, color: "#57534e" }, children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0 }, children: reason })
  ] });
}

// src/ui/App.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var STAGES = [
  { id: "setting", label: "\u2460 \u8BBE\u5B9A", reason: "" },
  { id: "planning", label: "\u2461 \u89C4\u5212", reason: "\u9700\u8981\u7F16\u5E74\u53F2\u4E0E\u4E8B\u4EF6\uFF08\u5C1A\u672A\u5B9E\u73B0\uFF09" },
  { id: "writing", label: "\u2462 \u521B\u4F5C", reason: "\u9700\u8981\u5377/\u96C6/\u7AE0\uFF08\u5C1A\u672A\u5B9E\u73B0\uFF09" }
];
var SYSTEMS = [
  { id: "world", label: "\u4E16\u754C\u89C2" },
  { id: "geography", label: "\u5730\u7406" },
  { id: "characters", label: "\u4EBA\u7269" },
  { id: "factions", label: "\u52BF\u529B" },
  { id: "chronicle", label: "\u7F16\u5E74\u53F2" },
  { id: "events", label: "\u4E8B\u4EF6" }
];
var message = (e) => e instanceof Error ? e.message : String(e);
var muted = { color: "#a8a29a" };
function App({ onClose }) {
  const [stage, setStage] = (0, import_react2.useState)("setting");
  const [system, setSystem] = (0, import_react2.useState)("world");
  const [worlds, setWorlds] = (0, import_react2.useState)([]);
  const [world, setWorld] = (0, import_react2.useState)("");
  const [nodes, setNodes] = (0, import_react2.useState)([]);
  const [selected, setSelected] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const reloadWorlds = (0, import_react2.useCallback)(async () => {
    try {
      const list = await listWorlds();
      setWorlds(list);
      setWorld((cur) => list.includes(cur) ? cur : list[0] ?? "");
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, []);
  (0, import_react2.useEffect)(() => {
    void reloadWorlds();
  }, [reloadWorlds]);
  (0, import_react2.useEffect)(() => {
    setNodes([]);
    setSelected(null);
    if (!world) return;
    let alive = true;
    setLoading(true);
    listNodes(world).then((list) => {
      if (!alive) return;
      setNodes(list);
      setError(null);
    }).catch((e) => {
      if (alive) setError(message(e));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [world]);
  const reloadNodes = (0, import_react2.useCallback)(async () => {
    if (!world) return;
    try {
      setNodes(await listNodes(world));
    } catch (e) {
      setError(message(e));
    }
  }, [world]);
  const selectNode = async (record) => {
    const id = String(record["id"] ?? "");
    if (!world || !id) return;
    try {
      setSelected(await readNode(world, id));
    } catch (e) {
      setError(message(e));
    }
  };
  const newEntry = () => {
    const stamp = Date.now().toString(36);
    setSelected({ id: `entry-${stamp}`, title: `\u65B0\u6761\u76EE-${stamp}`, body: "", kind: "entry", extra: {} });
  };
  const handleSaved = (saved) => {
    setSelected(saved);
    void reloadNodes();
  };
  const stageMeta = STAGES.find((s) => s.id === stage) ?? STAGES[0];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    position: "absolute",
    inset: 0,
    zIndex: 41,
    background: "#faf9f7",
    color: "#2c2926",
    display: "flex",
    flexDirection: "column",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "8px 16px",
      background: "#fff",
      borderBottom: "1px solid #e7e2da"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { style: { fontSize: 15 }, children: "\u5C0F\u8BF4\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("nav", { style: { display: "flex", gap: 6 }, children: STAGES.map((item) => {
        const enabled = item.id === "setting";
        const active = item.id === stage;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            disabled: !enabled,
            title: item.reason || void 0,
            onClick: () => {
              if (enabled) setStage(item.id);
            },
            style: {
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid transparent",
              background: active ? "#b45309" : "transparent",
              color: enabled ? active ? "#fff" : "#2c2926" : "#a8a29a",
              cursor: enabled ? "pointer" : "not-allowed",
              fontSize: 13
            },
            children: item.label
          },
          item.id
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: onClose, style: {
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid #e7e2da",
        background: "#fff",
        cursor: "pointer",
        fontSize: 13
      }, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flex: 1, minHeight: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("aside", { style: {
        width: 200,
        flexShrink: 0,
        padding: "12px 10px",
        background: "#fff",
        borderRight: "1px solid #e7e2da",
        overflow: "auto"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, letterSpacing: 1, ...muted, padding: "0 8px 8px" }, children: "\u8BBE\u5B9A\u7CFB\u7EDF" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0 }, children: SYSTEMS.map((item) => {
          const enabled = item.id === "world";
          const active = item.id === system;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              disabled: !enabled,
              title: enabled ? void 0 : "\u5C1A\u672A\u5B9E\u73B0",
              onClick: () => {
                if (enabled) setSystem(item.id);
              },
              style: {
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                marginBottom: 2,
                borderRadius: 6,
                border: "none",
                background: active ? "#f6efe6" : "transparent",
                color: enabled ? "#2c2926" : "#a8a29a",
                cursor: enabled ? "pointer" : "not-allowed",
                fontSize: 13,
                textAlign: "left"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: item.label }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 10 }, children: active ? "\u25CF" : "\u25CB" })
              ]
            }
          ) }, item.id);
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 16, padding: "0 8px", fontSize: 11, ...muted }, children: "\u8BCA\u65AD\uFF1A\u5C1A\u672A\u63A5\u5165" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("main", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "auto" }, children: stage === "setting" && system === "world" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid #e7e2da",
          background: "#fff"
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 12, ...muted }, children: "\u4E16\u754C" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "select",
            {
              value: world,
              disabled: worlds.length === 0,
              onChange: (e) => setWorld(e.target.value),
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #e7e2da", background: "#fff" },
              children: worlds.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: "", children: "\u8FD8\u6CA1\u6709\u4E16\u754C" }) : worlds.map((w) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: w, children: w }, w))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: newEntry, disabled: !world, style: {
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid #e7e2da",
            background: "#fff",
            color: world ? "#2c2926" : "#a8a29a",
            cursor: world ? "pointer" : "not-allowed",
            fontSize: 13
          }, children: "\uFF0B \u65B0\u5EFA\u6761\u76EE" }),
          loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 12, ...muted }, children: "\u52A0\u8F7D\u4E2D\u2026" }) : null
        ] }),
        error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "alert", style: {
          margin: "10px 16px 0",
          padding: "8px 10px",
          borderRadius: 6,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          fontSize: 13
        }, children: error }) : null,
        worlds.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 24, color: "#a8a29a" }, children: "\u5728 data/worlds/ \u4E0B\u8FD8\u6CA1\u6709\u4E16\u754C\u3002\u5148\u7528\u7F16\u8F91\u5668\u521B\u5EFA world.yaml \u4E0E nodes/ \u76EE\u5F55\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flex: 1, minHeight: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid #e7e2da",
            background: "#fff",
            overflow: "auto",
            padding: "8px 6px"
          }, children: [
            nodes.length === 0 && !loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 8, fontSize: 12, ...muted }, children: "\u8FD8\u6CA1\u6709\u6761\u76EE" }) : null,
            nodes.map((node) => {
              const id = String(node["id"] ?? "");
              const active = selected !== null && String(selected["id"] ?? "") === id;
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => void selectNode(node),
                  style: {
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                    padding: "7px 10px",
                    marginBottom: 2,
                    borderRadius: 6,
                    border: "none",
                    background: active ? "#f6efe6" : "transparent",
                    color: "#2c2926",
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: String(node["title"] ?? id) }),
                    node["kind"] === "axiom" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 10, color: "#b45309", flexShrink: 0 }, children: "\u516C\u7406" }) : null
                  ]
                },
                id
              );
            })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { flex: 1, minWidth: 0, overflow: "auto" }, children: selected ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            NodeEditor,
            {
              world,
              node: selected,
              onSaved: handleSaved
            },
            String(selected["id"] ?? "")
          ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 24, color: "#a8a29a" }, children: "\u9009\u62E9\u5DE6\u4FA7\u6761\u76EE\uFF0C\u6216\u65B0\u5EFA\u4E00\u6761\u3002" }) })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(StagePlaceholder, { title: stageMeta.label, reason: stageMeta.reason || "\u5C1A\u672A\u5B9E\u73B0" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("aside", { "aria-label": "\u68C0\u67E5\u5668\uFF08\u672C\u4EFB\u52A1\u7559\u7A7A\uFF09", style: {
        width: 220,
        flexShrink: 0,
        borderLeft: "1px solid #e7e2da",
        background: "#fff"
      } })
    ] })
  ] });
}

// src/ui/client.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var open = false;
var listeners = /* @__PURE__ */ new Set();
function toggleWorkbench(next) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}
function Launcher() {
  const [visible, setVisible] = (0, import_react3.useState)(open);
  (0, import_react3.useEffect)(() => {
    const fn = (v) => setVisible(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { onClick: () => toggleWorkbench(), style: {
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
    visible && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(App, { onClose: () => toggleWorkbench(false) })
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
