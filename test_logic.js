// 无头验证核心逻辑：vm + 最小 DOM mock
const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync("/tmp/smoke-app.js", "utf8");

// ---- 最小 DOM mock ----
function makeEl() {
  const el = {
    innerHTML: "", textContent: "", value: "", checked: false,
    className: "", style: {}, files: [],
    classList: { _set: new Set(), add(c){ this._set.add(c); }, remove(c){ this._set.delete(c); },
      toggle(c, on){ if(on === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else { on ? this._set.add(c) : this._set.delete(c); } },
      contains(c){ return this._set.has(c); } },
    appendChild(){}, remove(){}, click(){}, addEventListener(){},
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
  confirm(){ return true; }, alert(){}, FileReader: function(){},
  Blob: function(){}, URL: { createObjectURL(){return "";}, revokeObjectURL(){} },
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

// let/const 变量不挂全局，用表达式读
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

// 4. 目标超了变红（当前今天 1 根，再加 1 根 = 2 > goal 1）
ctx.addRecord();
R("state.goal = 1");
ctx.renderMain();
ok(els.get("count-num").classList.contains("over"), "超目标 count-num 变红");
ok(els.get("goal-text").classList.contains("over"), "超目标 goal-text 变红");

// 5. 等待缓冲：开启后 onSmokeTap 进倒计时而非直接记
R("state.goal = 20; state.bufferEnabled = true; state.bufferMinutes = 3");
const before = R("state.records.length");
ctx.onSmokeTap();
ok(R("state.records.length") === before, "缓冲开启时点击不立即记");
ok(R("bufferUntil") > Date.now(), "bufferUntil 已设到未来");

// 6. tickBuffer 到点后显示 approve 按钮
R("bufferUntil = Date.now() - 1");
ctx.tickBuffer();
ok(els.get("buffer-timer").textContent === "00:00", "倒计时归零");
ok(els.get("btn-approve").style.display === "block", "到点显示批准按钮");

// 7. 批准 → 记一根
const beforeApprove = R("state.records.length");
ctx.approveSmoke();
ok(R("state.records.length") === beforeApprove + 1, "approveSmoke 记一根");

// 8. resistSmoke 记 resisted
const beforeResist = R("state.resisted.length");
ctx.resistSmoke();
ok(R("state.resisted.length") === beforeResist + 1, "resistSmoke 记录忍住的冲动");

// 9. 跨天隔离
R("state.records.push(Date.now() - 24*3600*1000)");
ok(R("countOn(todayStr())") !== R("state.records.length"), "countOn 按天隔离");

// 10. 持久化 round-trip
R("state = { records: [Date.now()], resisted: [], goal: 42, bufferEnabled: true, bufferMinutes: 7 }");
ctx.save();
const saved = localStorage._d["smoke-tracker-v1"];
ok(saved && saved.length > 0, "save 写入了 localStorage");
R("state = { records: [], resisted: [], goal: 1, bufferEnabled: false, bufferMinutes: 1 }");
ctx.load();
ok(R("state.goal") === 42 && R("state.bufferMinutes") === 7, "load 恢复持久化数据");

console.log("\n结果: " + pass + " 通过, " + fail + " 失败");
process.exit(fail ? 1 : 0);
