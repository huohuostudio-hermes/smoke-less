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
      toggle(c, on){ if(on === undefined){ this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
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

// 3. 再加一根 + 撤销 + 反撤销（新栈）
ctx.addRecord();
ok(R("state.records.length") === 2, "第二根 records=2");
ok(R("undoStack.length") === 2, "undoStack 累积 2 项");
ctx.undoLast();
ok(R("state.records.length") === 1, "撤销后 records=1");
ok(R("undoStack.length") === 1, "撤销后 undoStack=1");
ok(R("redoStack.length") === 1, "撤销后 redoStack=1");
ctx.redoLast();
ok(R("state.records.length") === 2, "反撤销后 records=2");
ok(R("redoStack.length") === 0, "反撤销后 redoStack 清空");
ctx.redoLast();
ok(R("state.records.length") === 2, "无可反撤销时 redoLast 不动作");

// 3b. 撤销「忍住了」也可撤/反撤
const resistBefore = R("state.resisted.length");
ctx.resistSmoke();
ok(R("state.resisted.length") === resistBefore + 1, "resistSmoke 记一次忍住");
ctx.undoLast();
ok(R("state.resisted.length") === resistBefore, "撤销「忍住了」后 resisted 回退");
ctx.redoLast();
ok(R("state.resisted.length") === resistBefore + 1, "反撤销「忍住了」恢复");

// 4. 目标超了变红
ctx.addRecord();
R("state.goal = 1");
ctx.renderMain();
ok(els.get("count-num").classList._set.has("over"), "超目标 count-num 变红");
ok(els.get("goal-text").classList._set.has("over"), "超目标 goal-text 变红");

// 5. 缓冲开启时 triggerSmoke 进倒计时而非直接记
R("state.goal = 20; state.bufferEnabled = true; state.bufferMinutes = 3");
const before = R("state.records.length");
ctx.triggerSmoke();
ok(R("state.records.length") === before, "缓冲开启时 triggerSmoke 不立即记");
ok(R("bufferUntil") > Date.now(), "bufferUntil 已设到未来");
ok(els.get("btn-givelip").style.display === "block", "倒计时页显示「忍不住抽了」");

// 5b. 忍不住抽了：写入记录
const beforeGive = R("state.records.length");
ctx.giveLipSmoke();
ok(R("state.records.length") === beforeGive + 1, "giveLipSmoke 记一根（忍不住也入记录）");
ok(R("undoStack.length") >= 1, "忍不住后进入撤销栈");

// 6. 缓冲关闭时 triggerSmoke 直接记一根
R("state.bufferEnabled = false");
const before2 = R("state.records.length");
ctx.triggerSmoke();
ok(R("state.records.length") === before2 + 1, "缓冲关闭时 triggerSmoke 记一根");

// 7. tickBuffer 到点后显示 approve 按钮、隐藏「忍不住抽了」
R("bufferUntil = Date.now() - 1");
ctx.tickBuffer();
ok(els.get("buffer-timer").textContent === "00:00", "倒计时归零");
ok(els.get("btn-approve").style.display === "block", "到点显示批准按钮");
ok(els.get("btn-givelip").style.display === "none", "到点隐藏「忍不住抽了」");

// 8. approveSmoke 记一根
const beforeApprove = R("state.records.length");
ctx.approveSmoke();
ok(R("state.records.length") === beforeApprove + 1, "approveSmoke 记一根");

// 9. resistSmoke 记 resisted（上面 3b 已覆盖，这里只验证推进栈）
const beforeResist2 = R("state.resisted.length");
ctx.resistSmoke();
ok(R("state.resisted.length") === beforeResist2 + 1, "resistSmoke 记录忍住的冲动");

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

// ---- 打火机动画 ----
ctx.updateLighter(0);
ok(els.get("lid").style.transform === "rotateX(0.0deg)", "p=0 盖子闭合，实际: " + els.get("lid").style.transform);
ok(els.get("lid").style.opacity === "1", "p=0 盖子不透明");
ok(els.get("wheel").style.transform === "rotate(0.0deg)", "p=0 滑轮未转");
ctx.updateLighter(0.3);
ok(els.get("lid").style.transform === "rotateX(-165.0deg)", "p=0.3 盖子完全掀开，实际: " + els.get("lid").style.transform);
ok(els.get("lid").style.opacity === "0.00", "p=0.3 盖子翻到后面渐隐");
ctx.updateLighter(0.6);
ok(els.get("wheel").style.transform !== "rotate(0.0deg)", "搓轮阶段齿轮旋转");
ok(els.get("lighter").classList._set.has("sparking"), "搓轮阶段有火花");
ctx.updateLighter(1);
ok(!els.get("lighter").classList._set.has("sparking"), "到底后火花停");
ctx.resetLighter();
ok(els.get("lid").style.transform === "rotateX(0deg)", "reset 后盖子闭合");
ok(els.get("lid").style.opacity === "1", "reset 后盖子恢复不透明");
ok(els.get("wheel").style.transform === "rotate(0deg)", "reset 后滑轮归零");
ok(!els.get("lighter").classList._set.has("lit"), "reset 后火苗熄灭");

// ---- 趋势 + 详情 ----
// 15. 30 天趋势：30 根柱子 + 可点击进详情
R("state = { records: [], resisted: [], goal: 20, bufferEnabled: false, bufferMinutes: 3 }");
ctx.renderMain();
const trendHtml = els.get("trend").innerHTML;
ok((trendHtml.match(/class="day"/g) || []).length === 30, "趋势渲染 30 天柱子");
ok(trendHtml.indexOf('onclick="showDetail(') >= 0, "柱子带 showDetail 点击");
ok(/height:3px/.test(trendHtml), "0 根时柱子 3px");

// 16. 详情页：抽了几根 + 忍住几次 + 时间线
R("state = { records: [], resisted: [], goal: 20, bufferEnabled: false, bufferMinutes: 3 }");
const now = Date.now();
R("state.records.push(" + now + ", " + (now - 3600*1000) + ")");
R("state.resisted.push(" + (now - 1800*1000) + ")");
ctx.showDetail(R("todayStr()"));
ok(els.get("detail-summary").innerHTML.indexOf(">2<") >= 0, "详情汇总：抽了 2 根");
ok(els.get("detail-summary").innerHTML.indexOf(">1<") >= 0, "详情汇总：忍住了 1 次");
const dtl = els.get("detail-timeline").innerHTML;
ok(dtl.indexOf("第 2 根") >= 0, "详情时间线含第 2 根");
ok(dtl.indexOf("dot resist") >= 0, "详情时间线含忍住（绿点）");
ok(dtl.indexOf("第一根烟") >= 0, "第一根（最早）标「第一根烟」");
ok(dtl.indexOf("第 2 根") < dtl.indexOf("第一根烟"), "时间线降序：第 2 根在上、第一根烟在下");
ok(els.get("detail-title").textContent !== "", "详情标题非空");

// 17. 主屏不再显示「N 根」（tl-count 已移除）
R("state = { records: [Date.now()], resisted: [], goal: 20, bufferEnabled: false, bufferMinutes: 3 }");
ctx.renderMain();
ok(els.get("tl-today").textContent.indexOf("今日") >= 0, "主屏今日标题正常");

// 18. 音效 data URI 已内联
ok(code.indexOf("data:audio/mp4;base64,") >= 0, "音效 data URI 已内联进脚本");

console.log("\n结果: " + pass + " 通过, " + fail + " 失败");
process.exit(fail ? 1 : 0);
