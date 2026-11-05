/*
  六六云 666Clouds VPS 流量信息 (Surge 面板)
  面板样式与 peekabo.js 保持一致: IP / 地区 / 已用 / 剩余 / 上下行 / 重置 (+ 限速提示)
  依赖参数(argument): token=<流量 API 密钥>&id=<可选, 服务编号>&ip=<可选, 服务器 IP>&icon=<SF Symbol>&icon-color=<6位HEX>&ip-mode=<full|mask|hide>
    - token: 我的账户 → 流量 API 创建的只读密钥
    - id 留空: 取名下第一台服务器
    - ip 留空: 不显示 IP / 地区 (流量 API 不返回 IP)
  数据来源: 只读流量 API https://666clouds.com/docs/traffic-api
  地区: ip-api.com 反查(中文), 失败回退 ipwho.is, 成功结果经 $persistentStore 缓存 24h
*/

const ARGS = parseArgs($argument || "");

// 模块参数默认值为空(""), 部分版本可能原样传入引号, 统一去掉
const unquote = (v) => String(v || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
const API_TOKEN = unquote(ARGS.token);
const SERVICE_ID = unquote(ARGS.id);
const SERVER_IP = unquote(ARGS.ip);
const API_BASE = "https://666clouds.com/api/v1/services";

const HTTP_TIMEOUT = 5; // 单个请求超时(秒), Surge $httpClient 的 timeout 单位为秒
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const PANEL_TITLE = "666Clouds Server"; // 面板标题
const PANEL_ICON = ARGS.icon || "xserve"; // 面板图标(SF Symbol), 模块参数可配置
const ERROR_ICON = "exclamationmark.triangle.fill"; // 错误态图标
// 图标颜色(6位HEX, 不含#), 模块参数可配置
const PANEL_ICON_COLOR = /^#?[0-9a-fA-F]{6}$/.test(String(ARGS["icon-color"] || "").trim())
  ? `#${String(ARGS["icon-color"]).trim().replace(/^#/, "")}`
  : "#3B82F6";
const WARN_COLOR = "#F59E0B"; // 限速 / 数据延迟
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

// bit/s → "500 Mbps" (1024 进制, 与官网额度一致)
function formatBps(bps) {
  if (!Number.isFinite(bps) || bps <= 0) return null;
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  let i = 0;
  let v = bps;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(v >= 100 ? 0 : 1))} ${units[i]}`;
}

// 按北京时间格式化: "2026-11-23 21:34"
function formatTime(ms) {
  const d = new Date(ms + 8 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// 接口字节数为十进制整数字符串, null 表示未知
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

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

const HTTP_ERRORS = {
  401: "密钥无效, 请核对或重新创建",
  403: "密钥权限被禁用",
  404: "该服务不在查询范围内, 请检查 id",
  429: "请求过于频繁, 请稍后再试",
  503: "流量数据暂不可读, 请稍后再试",
};

(async () => {
  try {
    if (!API_TOKEN) return fail("请在模块参数中填写 token");
    if (SERVICE_ID && !/^\d+$/.test(SERVICE_ID)) return fail("服务编号 id 无效");

    // 填了 id 查单台, 否则查列表取第一台
    const url = SERVICE_ID ? `${API_BASE}/${SERVICE_ID}/traffic` : `${API_BASE}/traffic?limit=1`;
    const res = await httpGet(url, { Accept: "application/json", Authorization: `Bearer ${API_TOKEN}` });
    if (res.status !== 200) return fail(HTTP_ERRORS[res.status] || `API 请求失败 (HTTP ${res.status})`);

    let json;
    try {
      json = JSON.parse(res.body);
    } catch (_) {
      return fail("API 响应解析失败");
    }
    const svc = SERVICE_ID ? json?.data : json?.data?.items?.[0];
    if (!svc) return fail("名下没有可查询的服务器");

    const t = svc.traffic || {};
    if (t.status === "unavailable") return fail("流量数据暂不可读, 请稍后再试");
    const down = num(t.downloadBytes);
    const up = num(t.uploadBytes);
    const used = num(t.usedBytes);
    const quota = num(t.quotaBytes);
    const remaining = num(t.remainingBytes);
    if (!Number.isFinite(used)) return fail("API 返回的流量信息不完整");

    // 地区反查(带缓存, 失败不阻塞)
    const region = SERVER_IP ? await getGeo(SERVER_IP) : null;

    let quotaText;
    if (t.unlimited === true) quotaText = `${formatBytes(used)} / 不限`;
    else if (quota > 0) {
      const pct = Number.isFinite(t.usedPercent) ? t.usedPercent : (used / quota) * 100;
      quotaText = `${formatBytes(used)} / ${formatBytes(quota)} (${pct.toFixed(2)}%)`;
    } else quotaText = formatBytes(used);

    const resetAt = Date.parse(svc.cycle?.nextResetAt);
    const daysLeft = Number.isFinite(resetAt) ? Math.max(0, Math.ceil((resetAt - Date.now()) / 86400000)) : null;

    // 限速提示: policy.state 不是 normal 时显示当前带宽上限, 图标变橙色
    const policy = svc.policy || {};
    const throttled = Boolean(policy.state) && policy.state !== "normal";
    const downLimit = formatBps(num(policy.downloadLimitBps));
    const upLimit = formatBps(num(policy.uploadLimitBps));
    const limitText = [downLimit && `↓ ${downLimit}`, upLimit && `↑ ${upLimit}`].filter(Boolean).join(" ");
    const stale = t.status === "stale";
    const warn = throttled || stale;

    const content = [
      throttled ? `⚠️ 已限速${limitText ? `: ${limitText}` : ` (${policy.state})`}` : null,
      SERVER_IP && IP_MODE !== "hide" ? `IP: ${IP_MODE === "mask" ? maskIp(SERVER_IP) : SERVER_IP}` : null,
      SERVER_IP ? `地区: ${region || "未知"}` : null,
      `已用: ${quotaText}`,
      t.unlimited !== true && Number.isFinite(remaining) ? `剩余: ${formatBytes(Math.max(0, remaining))}` : null,
      Number.isFinite(down) && Number.isFinite(up) ? `上下行: ↓ ${formatBytes(down)} ↑ ${formatBytes(up)}` : null,
      daysLeft !== null ? `重置: ${formatTime(resetAt)} (${daysLeft} 天后)` : null,
      stale ? "⚠️ 数据为旧快照, 可能有延迟" : null,
    ]
      .filter(Boolean)
      .join("\n");

    finish(PANEL_TITLE, content, warn ? ERROR_ICON : PANEL_ICON, warn ? WARN_COLOR : PANEL_ICON_COLOR);
  } catch (e) {
    fail(String((e && e.message) || e));
  }
})();
