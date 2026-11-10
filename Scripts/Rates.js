/*
  汇率面板 (Surge 面板)
  参数(argument): icon=<SF Symbol>&color=<#HEX>，都可省略
  数据源: exchangerate-api.com，以人民币为基准，每天更新一次
*/

const API_URL = "https://api.exchangerate-api.com/v4/latest/CNY";
const HTTP_TIMEOUT = 8; // 秒
const TITLE = "汇率";
const ERROR_ICON = "exclamationmark.triangle.fill";
const ERROR_COLOR = "#EF4444";

// [旗帜, 名称, 货币代码, 方向]  toCny: 1 外币兑多少人民币; fromCny: 1 人民币兑多少外币
const ROWS = [
  ["🇺🇸", "美元", "USD", "toCny"],
  ["🇪🇺", "欧元", "EUR", "toCny"],
  ["🇬🇧", "英镑", "GBP", "toCny"],
  ["🇭🇰", "港币", "HKD", "fromCny"],
  ["🇯🇵", "日元", "JPY", "fromCny"],
  ["🇰🇷", "韩元", "KRW", "fromCny"],
  ["🇹🇷", "里拉", "TRY", "fromCny"],
];

const params = parseArgs(typeof $argument === "string" ? $argument : "");
const ICON = params.icon || "yensign.circle";
const COLOR = params.color || "#D4AF37";

function parseArgs(str) {
  const out = {};
  for (const pair of str.split("&")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    let value = pair.slice(idx + 1);
    try {
      value = decodeURIComponent(value);
    } catch (_) {}
    out[pair.slice(0, idx).trim()] = value.trim();
  }
  return out;
}

function fail(msg) {
  $done({ title: TITLE, content: `❌ ${msg}`, icon: ERROR_ICON, "icon-color": ERROR_COLOR });
}

function formatRow([flag, name, code, direction], rates) {
  const rate = Number(rates[code]);
  const ok = Number.isFinite(rate) && rate > 0;
  // 面板是比例字体, 靠"等号左边的字符组成相同"来对齐: 币种名都是两个汉字, "元"后面补一个全角空格
  if (direction === "toCny") return `${flag} 1 ${name} = 🇨🇳 ${ok ? (1 / rate).toFixed(2) : "N/A"} 元`;
  return `🇨🇳 1 元\u3000 = ${flag} ${ok ? rate.toFixed(2) : "N/A"} ${name}`;
}

$httpClient.get({ url: API_URL, timeout: HTTP_TIMEOUT }, (error, response, data) => {
  try {
    if (error) return fail(`请求失败: ${error}`);
    if (!response || response.status !== 200) return fail(`接口返回 HTTP ${response && response.status}`);

    let rates;
    try {
      rates = JSON.parse(data).rates;
    } catch (_) {}
    if (!rates || typeof rates !== "object") return fail("接口返回的数据无法解析");

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    $done({
      title: `${TITLE} · ${pad(now.getHours())}:${pad(now.getMinutes())}`,
      content: ROWS.map((row) => formatRow(row, rates)).join("\n"),
      icon: ICON,
      "icon-color": COLOR,
    });
  } catch (e) {
    fail(String((e && e.message) || e));
  }
});
