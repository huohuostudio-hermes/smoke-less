// 熄火 · 戒烟记录小组件（Scriptable）
// 数据：iCloud Drive/Scriptable/smoke-data.json，与网页版同结构 { records:[ts], resisted:[ts], goal:20 }
// 点小组件 = 记一根；在 Scriptable App 里打开 = 菜单（记一根/撤销/改目标/打开网页）

const DATA_FILE = "smoke-data.json";
const SCRIPT_NAME = "熄火";
const GOAL_DEFAULT = 20;
const APP_URL = "https://huohuostudio-hermes.github.io/smoke-less/";
const ACCENT = new Color("#ff7a2f");
const DANGER = new Color("#ff5c5c");
const TEXT = new Color("#f2ece4");
const MUTED = new Color("#8a847c");
const BG = new Color("#0e0e10");
const TRACK = new Color("#26262b");

function fm() { return FileManager.iCloud() || FileManager.local(); }
function load() {
  const f = fm();
  if (!f.fileExists(DATA_FILE)) return { records: [], resisted: [], goal: GOAL_DEFAULT };
  try { return JSON.parse(f.readString(DATA_FILE)); } catch (e) { return { records: [], resisted: [], goal: GOAL_DEFAULT }; }
}
function save(d) { fm().writeString(DATA_FILE, JSON.stringify(d)); }
function dayStr(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function today() { return dayStr(Date.now()); }
function countOn(d, day) { return d.records.filter(t => dayStr(t) === day).length; }
function addRecord(d) { d.records.push(Date.now()); save(d); }
function undoLast(d) {
  const t = today();
  const recs = d.records.filter(x => dayStr(x) === t);
  if (!recs.length) return false;
  const last = Math.max(...recs);
  d.records.splice(d.records.indexOf(last), 1);
  save(d);
  return true;
}

function progressImage(n, goal) {
  const w = 150, h = 7, r = h / 2;
  const c = new DrawContext();
  c.size = new Size(w, h);
  c.opaque = false;
  c.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, w, h), r, r);
  c.addPath(track);
  c.setFillColor(TRACK);
  c.fillPath();
  const pct = Math.min(1, goal > 0 ? n / goal : 0);
  if (pct > 0) {
    const fw = Math.max(h, w * pct);
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 0, fw, h), r, r);
    c.addPath(fill);
    c.setFillColor(n > goal ? DANGER : ACCENT);
    c.fillPath();
  }
  return c.getImage();
}

function renderWidget() {
  const d = load();
  const n = countOn(d, today());
  const rn = d.resisted.filter(t => dayStr(t) === today()).length;
  const goal = d.goal || GOAL_DEFAULT;

  const w = new ListWidget();
  w.backgroundColor = BG;
  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(SCRIPT_NAME) + "&action=record";

  const title = w.addText("🔥 熄火");
  title.font = Font.mediumSystemFont(12);
  title.textColor = MUTED;

  const num = w.addText(String(n));
  num.font = Font.boldSystemFont(34);
  num.textColor = n > goal ? DANGER : TEXT;

  let sub = n === 0 ? "今天还没抽" : ("目标 " + goal + " · 剩 " + Math.max(0, goal - n));
  if (rn > 0) sub += " · 💪" + rn;
  const subT = w.addText(sub);
  subT.font = Font.regularSystemFont(11);
  subT.textColor = MUTED;

  w.addSpacer(6);
  w.addImage(progressImage(n, goal));
  w.addSpacer(8);

  const hint = w.addText("点我 = 记一根");
  hint.font = Font.mediumSystemFont(10);
  hint.textColor = ACCENT;
  hint.centerAlignText();

  Script.setWidget(w);
}

async function showMenu() {
  const d = load();
  const n = countOn(d, today());
  const m = new Alert();
  m.title = "熄火";
  m.message = "今日已抽 " + n + " 根 · 目标 " + (d.goal || GOAL_DEFAULT);
  m.addAction("记一根");
  m.addAction("撤销上一根");
  m.addAction("改目标");
  m.addAction("打开熄火网页");
  m.addCancelAction("取消");
  const i = await m.presentSheet();
  if (i === 0) { addRecord(d); }
  else if (i === 1) { undoLast(d); }
  else if (i === 2) { await setGoal(d); }
  else if (i === 3) { Safari.open(APP_URL); }
  renderWidget();
}

async function setGoal(d) {
  const a = new Alert();
  a.title = "每日目标";
  a.addTextField("根数", String(d.goal || GOAL_DEFAULT));
  a.addAction("保存");
  a.addCancelAction("取消");
  const i = await a.presentAlert();
  if (i === 0) {
    const v = parseInt(a.textFieldValue(0), 10);
    if (v > 0) { d.goal = v; save(d); }
  }
}

async function recordAndNotify() {
  const d = load();
  addRecord(d);
  renderWidget();
  const a = new Alert();
  a.title = "已记一根";
  a.message = "今日已抽 " + countOn(d, today()) + " 根";
  a.addAction("好");
  await a.presentAlert();
}

// 入口
if (config.runsInWidget) {
  renderWidget();
  Script.complete();
} else {
  const q = (typeof args !== "undefined" && args.queryParameters) || {};
  if (q.action === "record") { recordAndNotify(); }
  else { showMenu(); }
}
