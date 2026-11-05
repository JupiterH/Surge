/*
  六六云 666Clouds VPS 流量信息 (Surge 面板)
  面板样式与 peekabo.js 保持一致: IP / 地区 / 已用 / 剩余 / 上下行 / 重置
  依赖参数(argument): id=<实例ID>&cookie=<登录 Cookie>&ip=<可选, 留空自动识别>&icon=<SF Symbol>&icon-color=<6位HEX>&ip-mode=<full|mask|hide>
  cookie 留空时读取本机 $persistentStore 的 666clouds_cookie
  数据来源: 实例详情页 https://666clouds.com/portal/services/<id>
    - 服务端渲染的 HTML ("剩余流量" / "已用 x / y")
    - Next.js Flight 数据里的 flow 对象 (left/used/limit/in/out/reset)
  地区: ip-api.com 反查(中文), 失败回退 ipwho.is, 结果经 $persistentStore 缓存 24h
*/

const ARGS = parseArgs($argument || "");

const SERVICE_ID = String(ARGS.id || "").trim();
const COOKIE = ARGS.cookie || $persistentStore.read("666clouds_cookie") || "";
const MANUAL_IP = String(ARGS.ip || "").trim();
const PAGE_URL = `https://666clouds.com/portal/services/${encodeURIComponent(SERVICE_ID)}`;

const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const PANEL_TITLE = "666Clouds Server"; // 面板标题
const PANEL_ICON = ARGS.icon || "xserve"; // 面板图标(SF Symbol), 模块参数可配置
const ERROR_ICON = "exclamationmark.triangle.fill"; // 错误态图标
// 图标颜色(6位HEX, 不含#), 模块参数可配置
const PANEL_ICON_COLOR = /^#?[0-9a-fA-F]{6}$/.test(String(ARGS["icon-color"] || "").trim())
  ? `#${String(ARGS["icon-color"]).trim().replace(/^#/, "")}`
  : "#3B82F6";
const ERROR_COLOR = "#EF4444"; // 错误态
// IP 显示模式: full 完整 / mask 后两段打码 / hide 隐藏
const ipModeRaw = String(ARGS["ip-mode"] || "mask").toLowerCase();
const IP_MODE = ["full", "mask", "hide"].includes(ipModeRaw) ? ipModeRaw : "mask";

// 安全解码: 值含 % 或无效编码时不抛错, 原样返回
function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str;
  }
}

function parseArgs(str) {
  const out = {};
  if (!str) return out;
  for (const pair of str.split("&")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = safeDecode(pair.slice(0, idx)).trim();
    const value = safeDecode(pair.slice(idx + 1)).trim();
    if (key) out[key] = value;
  }
  return out;
}

function httpGet(url, headers, timeout = 10000) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers, timeout }, (error, response, data) => {
      if (error) reject(new Error(error));
      else resolve({ status: response.status, body: data });
    });
  });
}

function maskIp(ip) {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return ip;
}

// "187.5 GB" → 字节数 (1024 进制, 与 peekabo.js 一致)
function parseBytes(text) {
  const m = String(text || "").trim().match(/^([\d.]+)\s*([KMGTP]?)i?B?$/i);
  if (!m) return NaN;
  const pow = { "": 0, K: 1, M: 2, G: 3, T: 4, P: 5 }[m[2].toUpperCase()];
  return parseFloat(m[1]) * Math.pow(1024, pow);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 2)} ${units[i]}`;
}

// 页面原文 → 统一格式; 无法解析时保留原文
function fmt(text) {
  const b = parseBytes(text);
  return Number.isFinite(b) ? formatBytes(b) : String(text).trim();
}

// "2026-12-01 00:00 UTC+08" → { date, days }
function parseReset(text) {
  const m = String(text || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 8 * 3600 * 1000; // 北京时间 00:00
  const days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
  return { date: `${m[1]}-${m[2]}-${m[3]}`, days };
}

const isPublicIPv4 = (ip) => {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return false;
  if ([0, 10, 127].includes(p[0]) || p[0] >= 224) return false;
  if (p[0] === 169 && p[1] === 254) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
  return true;
};

// 页面里找实例 IP: 优先 Flight 数据中 ip/ipv4/address 字段, 再找 "IP" 字样附近的地址
function findIp(s) {
  const re4 = "(\\d{1,3}(?:\\.\\d{1,3}){3})";
  const candidates = [
    new RegExp(`\\\\"(?:ip|ipv4|ipAddress|ip_address|mainIp|main_ip|address)\\\\":\\\\"${re4}\\\\"`, "gi"),
    new RegExp(`IP(?:v4)?(?:\\s*地址)?[\\s\\S]{0,120}?${re4}`, "gi"),
  ];
  for (const re of candidates) {
    let m;
    while ((m = re.exec(s))) if (isPublicIPv4(m[1])) return m[1];
  }
  return "";
}

function composeRegion(country, regionName, city) {
  const parts = [];
  if (country) parts.push(country);
  if (regionName && regionName !== country && !parts.includes(regionName)) parts.push(regionName);
  if (city && !parts.includes(city)) parts.push(city);
  return parts.join(" ") || null;
}

async function getGeo(ip) {
  const key = `666clouds_geo_${ip}`;
  try {
    const cached = $persistentStore.read(key);
    if (cached) {
      const obj = JSON.parse(cached);
      if (obj.region && Date.now() - obj.ts < GEO_CACHE_TTL) return obj.region;
    }
  } catch (_) {}

  let region = null;
  // 主: ip-api.com (中文)
  try {
    const res = await httpGet(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,country,regionName,city,query`,
      { Accept: "application/json" }
    );
    if (res.status === 200) {
      const geo = JSON.parse(res.body);
      if (geo && geo.status === "success") region = composeRegion(geo.country, geo.regionName, geo.city);
    }
  } catch (_) {}

  // 备: ipwho.is (https)
  if (!region) {
    try {
      const res = await httpGet(`https://ipwho.is/${encodeURIComponent(ip)}`, { Accept: "application/json" });
      if (res.status === 200) {
        const geo = JSON.parse(res.body);
        if (geo && geo.success) region = composeRegion(geo.country, geo.region, geo.city);
      }
    } catch (_) {}
  }

  try {
    if (region) $persistentStore.write(JSON.stringify({ region, ts: Date.now() }), key);
  } catch (_) {}
  return region;
}

function finish(title, content, icon, iconColor) {
  $done({ title, content, icon, "icon-color": iconColor });
}

function fail(msg) {
  finish(PANEL_TITLE, `❌ ${msg}`, ERROR_ICON, ERROR_COLOR);
}

(async () => {
  try {
    if (!/^\d+$/.test(SERVICE_ID)) return fail("实例 ID 无效");
    if (!COOKIE || COOKIE === "PASTE_COOKIE_HERE") return fail("请先在模块参数中配置 Cookie");

    const res = await httpGet(
      PAGE_URL,
      {
        Cookie: COOKIE,
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile Safari/604.1",
      },
      15000
    );
    if (res.status !== 200) return fail(`HTTP ${res.status}, 请检查 Cookie`);

    const s = String(res.body || "");
    if (!s.includes("剩余流量") && !s.includes('\\"flow\\"')) return fail("未找到流量信息, 可能需要重新登录");

    // 服务端渲染的 HTML
    const html = s.match(/剩余流量<\/span><span[^>]*>([^<]+)<\/span>[\s\S]{0,600}?已用\s*([\d.]+\s*[A-Za-z]+)\s*\/\s*([\d.]+\s*[A-Za-z]+)/);
    // Next.js Flight 数据(转义的 JSON)
    const pick = (re) => (s.match(re) || [])[1];
    const left = (html && html[1]) || pick(/\\"left\\":\\"([^\\"]+)\\"/);
    const used = (html && html[2]) || pick(/\\"used\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"[\s\S]{0,100}?\\"limit\\"/);
    const limit = (html && html[3]) || pick(/\\"limit\\":\\"([^\\"]+)\\"/);
    const resetRaw = pick(/\\"reset\\":\\"([^\\"]+)\\"/) || pick(/(20\d\d-\d\d-\d\d\s+\d\d:\d\d\s+UTC\+08)[\s\S]{0,60}?重置/);
    const incoming = pick(/\\"in\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"/);
    const outgoing = pick(/\\"out\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"/);
    if (!left || !used || !limit) {
      console.log(`[666Clouds] 解析失败, 页面前 500 字符: ${s.slice(0, 500)}`);
      return fail("无法解析流量数据, 请检查脚本日志");
    }

    const ip = MANUAL_IP || findIp(s);
    if (!ip) console.log("[666Clouds] 页面中未识别到 IP, 可在模块参数 ip 中手动填写");
    // 地区反查(带缓存, 失败不阻塞)
    const region = ip ? await getGeo(ip) : null;

    const usedB = parseBytes(used);
    const limitB = parseBytes(limit);
    const percent = Number.isFinite(usedB) && limitB > 0 ? ` (${((usedB / limitB) * 100).toFixed(2)}%)` : "";
    const reset = parseReset(resetRaw);

    const content = [
      IP_MODE === "hide" ? null : `IP: ${ip ? (IP_MODE === "mask" ? maskIp(ip) : ip) : "未知"}`,
      `地区: ${region || "未知"}`,
      `已用: ${fmt(used)} / ${fmt(limit)}${percent}`,
      `剩余: ${fmt(left)}`,
      incoming && outgoing ? `上下行: ↓ ${fmt(incoming)} ↑ ${fmt(outgoing)}` : null,
      reset ? `重置: ${reset.date} (${reset.days} 天后)` : null,
    ]
      .filter(Boolean)
      .join("\n");

    finish(PANEL_TITLE, content, PANEL_ICON, PANEL_ICON_COLOR);
  } catch (e) {
    fail(String((e && e.message) || e));
  }
})();
