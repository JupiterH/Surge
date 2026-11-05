/*
  Peekabo 服务器流量信息 (Surge 面板)
  逻辑参考: xream/scripts → surge/modules/sub-store-scripts/sub-info/peekabo.js
  依赖参数(argument): id=<服务器ID>&token=<API Token>&icon=<SF Symbol>&icon-color=<6位HEX>&ip-mode=<full|mask|hide>
  面板样式与 666.js 保持一致: IP / 地区 / 已用 / 剩余 / 上下行 / 到期
  已用流量按服务器出站流量(tx)统计, 与 Peekabo 计费口径一致
  地区: ip-api.com 反查(中文), 失败回退 ipwho.is, 成功结果经 $persistentStore 缓存 24h
*/

const ARGS = parseArgs($argument || "");

// 模块参数默认值为空(""), 部分版本可能原样传入引号, 统一去掉
const unquote = (v) => String(v || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
const API_TOKEN = unquote(ARGS.token);
const SERVER_ID = unquote(ARGS.id);

const HTTP_TIMEOUT = 5; // 单个请求超时(秒), Surge $httpClient 的 timeout 单位为秒
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const PANEL_TITLE = "Peekabo Server"; // 面板标题
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

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers, timeout: HTTP_TIMEOUT }, (error, response, data) => {
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

// 按北京时间格式化: "2026-11-23 21:34"
function formatTime(ms) {
  const d = new Date(ms + 8 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function composeRegion(country, regionName, city) {
  const parts = [];
  if (country) parts.push(country);
  if (regionName && regionName !== country && !parts.includes(regionName)) parts.push(regionName);
  if (city && !parts.includes(city)) parts.push(city);
  return parts.join(" ") || null;
}

async function getGeo(ip) {
  const key = `peekabo_geo_${ip}`;
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

  // 只缓存成功结果, 失败下次刷新时重试
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
    if (!SERVER_ID || !API_TOKEN) return fail(`请在模块参数中填写 ${!SERVER_ID ? "id" : "token"}`);

    const res = await httpGet(
      `https://vf-hk.peekabo.io/api/server/${encodeURIComponent(SERVER_ID)}?state=true`,
      { Accept: "application/json", Authorization: `Bearer ${API_TOKEN}` }
    );
    if (res.status === 401 || res.status === 403) return fail(`Token 无效或无权限 (HTTP ${res.status})`);
    if (res.status !== 200) return fail(`API 请求失败 (HTTP ${res.status})`);

    let json;
    try {
      json = JSON.parse(res.body);
    } catch (_) {
      return fail("API 响应解析失败");
    }

    const data = json.data;
    const traffic = data?.state?.network?.primary?.traffic;
    const limit = String(data?.network?.primary?.limit || "")
      .trim()
      .match(/^(\d+(?:\.\d+)?)\s*GB$/i);
    const used = traffic?.tx; // 出站流量
    const rx = traffic?.rx; // 入站流量
    const total = limit ? Number(limit[1]) * 1024 ** 3 : NaN;
    const resetAt = Date.parse(data?.currentMonthlyPeriod?.end);
    const ip = data?.network?.primary?.ipv4?.[0]?.address || "";

    if (!Number.isFinite(used) || used < 0 || !(total > 0) || !Number.isFinite(resetAt)) {
      return fail("API 返回的流量信息不完整");
    }

    // 地区反查(带缓存, 失败不阻塞)
    const region = ip ? await getGeo(ip) : null;

    const usedText = formatBytes(used);
    const percent = ((used / total) * 100).toFixed(2);
    const daysLeft = Math.max(0, Math.ceil((resetAt - Date.now()) / 86400000));

    const content = [
      IP_MODE === "hide" ? null : `IP: ${ip ? (IP_MODE === "mask" ? maskIp(ip) : ip) : "未知"}`,
      `地区: ${region || "未知"}`,
      `已用: ${usedText} / ${formatBytes(total)} (${percent}%)`,
      `剩余: ${formatBytes(Math.max(0, total - used))}`,
      Number.isFinite(rx) && rx >= 0 ? `上下行: ↓ ${formatBytes(rx)} ↑ ${usedText}` : null,
      `到期: ${formatTime(resetAt)} (剩余 ${daysLeft} 天)`,
    ]
      .filter(Boolean)
      .join("\n");

    finish(PANEL_TITLE, content, PANEL_ICON, PANEL_ICON_COLOR);
  } catch (e) {
    fail(String((e && e.message) || e));
  }
})();
