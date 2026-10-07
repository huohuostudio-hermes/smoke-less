// 无头验证核心逻辑：vm + 最小 DOM mock
const fs = require("fs");
const vm = require("vm");

// 直接从 index.html 提取 script（确保测的是最新代码）
const html = fs.readFileSync("/Users/xingyan/projects/smoke-less/index.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.log("no script"); process.exit(1); }
const code = m[1];

// ---- 最小 DOM mock ----
function makeEl() {
  const el = {
    innerHTML: "", textContent: "", value: "", checked: false,
    className: "", style: {}, files: [], _attrs: {},
    classList: { _set: new Set(), add(c){ this._set.add(c); }, remove(c){ this._set.delete(c); },
      toggle(c, on){ if(on === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else { on ? this._set.add(c) : this._set.delete(c); } },
      contains(c){ return this._set.has(c); } },
    appendChild(){}, remove(){}, click(){}, addEventListener(){},
    setAttribute(k, v){ this._attrs[k] = v; },
    getAttribute(k){ return this._attrs[k]; },
  };
  return el;
}
const els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, makeEl()); return els.get(id); },
  createElement(){ return makeEl(); },
  querySelectorAll(){ return []; },
};
const localStorage = {
  _d: {},
  getItem(k){ return this._d[k] || null; },
  setItem(k, v){ this._d[k] = String(v); },
};
const ctx = {
  document, localStorage, console,
  Date, Math, JSON, String, Number, Array, Object, parseInt, isNaN,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
  confirm(){ return true; }, alert(){}, FileReader: function(){},
  Blob: function(){}, URL: { createObjectURL(){return "";}, revokeObjectURL(){} },
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

function R(expr){ return vm.runInContext(expr, ctx); }

// ---- 断言 ----
let pass = 0, fail = 0;
function ok(cond, msg){
  if(cond){ pass++; } else { fail++; console.log("✗ FAIL:", msg); }
}

// 1. 初始状态
ok(R("state.records.length") === 0, "初始无记录");
ok(R("state.goal") === 20, "默认目标 20");

// 2. 加一根
ctx.addRecord();
ok(R("state.records.length") === 1, "addRecord 后 records=1");
ok(R("dayStr(state.records[0])") === R("todayStr()"), "记录落在今天");
ok(els.get("count-num").textContent === 1, "计数显示 1");

// 3. 再加一根 + 撤销
ctx.addRecord();
ok(R("state.records.length") === 2, "第二根 records=2");
ctx.undoLast();
ok(R("state.records.length") === 1, "撤销后 records=1");

// 4. 目标超了变红（再加 1 根 = 2 > goal 1）
ctx.addRecord();
R("state.goal = 1");
ctx.renderMain();
ok(els.get("count-num").classList.contains("over"), "超目标 count-num 变红");
ok(els.get("goal-text").classList.contains("over"), "超目标 goal-text 变红");

// 5. 缓冲开启时 triggerSmoke 进倒计时而非直接记
R("state.goal = 20; state.bufferEnabled = true; state.bufferMinutes = 3");
const before = R("state.records.length");
ctx.triggerSmoke();
ok(R("state.records.length") === before, "缓冲开启时 triggerSmoke 不立即记");
ok(R("bufferUntil") > Date.now(), "bufferUntil 已设到未来");

// 6. 缓冲关闭时 triggerSmoke 直接记一根
R("state.bufferEnabled = false");
const before2 = R("state.records.length");
ctx.triggerSmoke();
ok(R("state.records.length") === before2 + 1, "缓冲关闭时 triggerSmoke 记一根");

// 7. tickBuffer 到点后显示 approve 按钮
R("bufferUntil = Date.now() - 1");
ctx.tickBuffer();
ok(els.get("buffer-timer").textContent === "00:00", "倒计时归零");
ok(els.get("btn-approve").style.display === "block", "到点显示批准按钮");

// 8. approveSmoke 记一根
const beforeApprove = R("state.records.length");
ctx.approveSmoke();
ok(R("state.records.length") === beforeApprove + 1, "approveSmoke 记一根");

// 9. resistSmoke 记 resisted
const beforeResist = R("state.resisted.length");
ctx.resistSmoke();
ok(R("state.resisted.length") === beforeResist + 1, "resistSmoke 记录忍住的冲动");

// 10. 跨天隔离
R("state.records.push(Date.now() - 24*3600*1000)");
ok(R("countOn(todayStr())") !== R("state.records.length"), "countOn 按天隔离");

// 11. 持久化 round-trip
R("state = { records: [Date.now()], resisted: [], goal: 42, bufferEnabled: true, bufferMinutes: 7 }");
ctx.save();
const saved = localStorage._d["smoke-tracker-v1"];
ok(saved && saved.length > 0, "save 写入了 localStorage");
R("state = { records: [], resisted: [], goal: 1, bufferEnabled: false, bufferMinutes: 1 }");
ctx.load();
ok(R("state.goal") === 42 && R("state.bufferMinutes") === 7, "load 恢复持久化数据");

// ---- 火焰光环 ----
// 12. updateFlame(0) 清空两条弧
ctx.updateFlame(0);
ok(els.get("arc-right").getAttribute("d") === "", "p=0 右弧为空");
ok(els.get("arc-left").getAttribute("d") === "", "p=0 左弧为空");

// 13. updateFlame(1) 两条弧终点都在顶部 (100, 12)
ctx.updateFlame(1);
const dR = els.get("arc-right").getAttribute("d");
const dL = els.get("arc-left").getAttribute("d");
ok(/A 88 88 0 0 0 100\.00 12\.00$/.test(dR), "p=1 右弧到顶点 (100,12)，实际: " + dR);
ok(/A 88 88 0 0 1 100\.00 12\.00$/.test(dL), "p=1 左弧到顶点 (100,12)，实际: " + dL);

// 14. updateFlame(0.5) 终点在右侧(188,100)/左侧(12,100)
ctx.updateFlame(0.5);
const dR2 = els.get("arc-right").getAttribute("d");
const dL2 = els.get("arc-left").getAttribute("d");
ok(/0 0 0 188\.00 100\.00$/.test(dR2), "p=0.5 右弧到 3 点 (188,100)，实际: " + dR2);
ok(/0 0 1 12\.00 100\.00$/.test(dL2), "p=0.5 左弧到 9 点 (12,100)，实际: " + dL2);

console.log("\n结果: " + pass + " 通过, " + fail + " 失败");
process.exit(fail ? 1 : 0);
