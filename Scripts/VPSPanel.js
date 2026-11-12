/*
  VPS 流量信息 (Surge 面板), 多服务商共用一份脚本
  依赖参数(argument): provider=<peekabo|666>&id=<服务器ID>&token=<API Token>&ip=<可选>&icon=<SF Symbol>&icon-color=<6位HEX>&ip-mode=<full|mask|hide>
  面板内容(标题带用量百分比): [警告] / 国旗 地区 · IP / 进度条 已用 / 总量 / 上下行 / 剩余 · 距重置天数
  面板是比例字体, 过长会自动换行; 各行按最宽的数值实测过, 不超过面板宽度的 93%
  图标颜色: 用量 70% 以上变橙, 90% 以上变红, 其余用 icon-color

  服务商:
    - peekabo: VirtFusion API (vf-hk.peekabo.io), Bearer Token, id 必填
               已用按出站流量(tx)统计, 与 Peekabo 计费口径一致; 被暂停(suspended)时提示, 图标变红
               逻辑参考: xream/scripts → surge/modules/sub-store-scripts/sub-info/peekabo.js
    - 666:     六六云只读流量 API (https://666clouds.com/docs/traffic-api), Bearer Token
               id 留空取名下第一台; 接口不返回 IP, ip 需手动填写(留空不显示 IP / 地区)
               限速(policy.state 非 normal)或旧快照时提示, 图标变橙
  新增服务商: 在 PROVIDERS 里加一项, fetch() 返回统一结构即可

  地区: ip-api.com 反查(中文), 失败回退 ipwho.is, 成功结果经 $persistentStore 缓存 30 天;
        两个接口都失败时沿用过期的旧缓存
*/

const ARGS = parseArgs(typeof $argument === "string" ? $argument : "");

// 模块参数默认值为空(""), 部分版本可能原样传入引号, 统一去掉
const unquote = (v) => String(v || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
const PROVIDER_KEY = unquote(ARGS.provider).toLowerCase();
const SERVER_ID = unquote(ARGS.id);
const API_TOKEN = unquote(ARGS.token);
const MANUAL_IP = unquote(ARGS.ip);

const HTTP_TIMEOUT = 5; // 单个请求超时(秒), Surge $httpClient 的 timeout 单位为秒
// 地区查询超时(秒): 最坏情况 5 + 3 + 3 = 11s, 留在模块 timeout=15 以内
const GEO_TIMEOUT = 3;
const GEO_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天, VPS 的 IP 归属地基本不变
const PANEL_ICON = unquote(ARGS.icon) || "xserve"; // 面板图标(SF Symbol), 模块参数可配置
const ERROR_ICON = "exclamationmark.triangle.fill"; // 错误 / 警告图标
// 图标颜色(6位HEX, 不含#), 模块参数可配置
const PANEL_ICON_COLOR = /^#?[0-9a-fA-F]{6}$/.test(unquote(ARGS["icon-color"]))
  ? `#${unquote(ARGS["icon-color"]).replace(/^#/, "")}`
  : "#22C55E";
const WARN_COLOR = "#F59E0B"; // 警告: 限速 / 数据延迟 / 用量 ≥ 70%
const ERROR_COLOR = "#EF4444"; // 错误: 请求失败 / 已暂停 / 用量 ≥ 90%
// IP 显示模式: full 完整 / mask 后两段打码 / hide 隐藏
const ipModeRaw = unquote(ARGS["ip-mode"] || "mask").toLowerCase();
const IP_MODE = ["full", "mask", "hide"].includes(ipModeRaw) ? ipModeRaw : "mask";

/* ================= 服务商 =================
  fetch() 成功时返回:
    { ip, used, quota, unlimited, remaining, down, up, resetAt(ms), warnings: [{ text, level: "warn"|"error" }] }
  数值未知用 NaN / null; 失败时 throw new Error("给用户看的提示")
*/
const PROVIDERS = {
  peekabo: {
    title: "Peekabo Server",
    name: "Peekabo",
    requireId: true,
    async fetch() {
      const res = await httpGet(
        `https://vf-hk.peekabo.io/api/server/${encodeURIComponent(SERVER_ID)}?state=true`,
        authHeaders()
      );
      if (res.status === 401 || res.status === 403) throw new Error(`Token 无效或无权限 (HTTP ${res.status})`);
      if (res.status !== 200) throw new Error(`API 请求失败 (HTTP ${res.status})`);

      const data = parseJson(res.body)?.data;
      const traffic = data?.state?.network?.primary?.traffic;
      const limit = String(data?.network?.primary?.limit || "").trim().match(/^(\d+(?:\.\d+)?)\s*(MB|GB|TB)$/i);
      const used = traffic?.tx; // 出站流量
      const quota = limit ? Number(limit[1]) * 1024 ** { MB: 2, GB: 3, TB: 4 }[limit[2].toUpperCase()] : NaN;
      const resetAt = Date.parse(data?.currentMonthlyPeriod?.end);
      if (!Number.isFinite(used) || used < 0 || !(quota > 0) || !Number.isFinite(resetAt)) {
        throw new Error("API 返回的流量信息不完整");
      }

      const warnings = [];
      // 续费信息不在 VirtFusion 接口里, 未续费等原因被暂停时 suspended 为 true
      if (data?.suspended === true) warnings.push({ text: "已暂停, 请检查续费", level: "error" });

      return {
        ip: data?.network?.primary?.ipv4?.[0]?.address || "",
        used,
        quota,
        unlimited: false,
        remaining: Math.max(0, quota - used),
        down: traffic?.rx, // 入站流量
        up: used,
        resetAt,
        warnings,
      };
    },
  },

  666: {
    title: "666Clouds Server",
    name: "666Clouds",
    requireId: false,
    async fetch() {
      if (SERVER_ID && !/^\d+$/.test(SERVER_ID)) throw new Error("服务编号 id 无效");
      const base = "https://666clouds.com/api/v1/services";
      // 填了 id 查单台, 否则查列表取第一台
      const res = await httpGet(SERVER_ID ? `${base}/${SERVER_ID}/traffic` : `${base}/traffic?limit=1`, authHeaders());
      const HTTP_ERRORS = {
        401: "密钥无效, 请核对或重新创建",
        403: "密钥权限被禁用",
        404: "该服务不在查询范围内, 请检查 id",
        429: "请求过于频繁, 请稍后再试",
        503: "流量数据暂不可读, 请稍后再试",
      };
      if (res.status !== 200) throw new Error(HTTP_ERRORS[res.status] || `API 请求失败 (HTTP ${res.status})`);

      const json = parseJson(res.body);
      const svc = SERVER_ID ? json?.data : json?.data?.items?.[0];
      if (!svc) throw new Error("名下没有可查询的服务器");
      const t = svc.traffic || {};
      if (t.status === "unavailable") throw new Error("流量数据暂不可读, 请稍后再试");
      // 接口字节数为十进制整数字符串, null 表示未知
      const used = num(t.usedBytes);
      if (!Number.isFinite(used)) throw new Error("API 返回的流量信息不完整");

      const warnings = [];
      const policy = svc.policy || {};
      if (policy.state && policy.state !== "normal") {
        const limits = [
          formatBps(num(policy.downloadLimitBps)) && `↓ ${formatBps(num(policy.downloadLimitBps))}`,
          formatBps(num(policy.uploadLimitBps)) && `↑ ${formatBps(num(policy.uploadLimitBps))}`,
        ].filter(Boolean);
        warnings.push({ text: `已限速${limits.length ? `: ${limits.join(" ")}` : ` (${policy.state})`}`, level: "warn" });
      }
      if (t.status === "stale") warnings.push({ text: "数据为旧快照, 可能有延迟", level: "warn" });

      return {
        ip: "", // 流量 API 不返回 IP
        used,
        quota: num(t.quotaBytes),
        unlimited: t.unlimited === true,
        usedPercent: t.usedPercent,
        remaining: num(t.remainingBytes),
        down: num(t.downloadBytes),
        up: num(t.uploadBytes),
        resetAt: Date.parse(svc.cycle?.nextResetAt),
        warnings,
      };
    },
  },
};

/* ================= 工具函数 ================= */

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

function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch (_) {
    throw new Error("API 响应解析失败");
  }
}

const authHeaders = () => ({ Accept: "application/json", Authorization: `Bearer ${API_TOKEN}` });
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

function httpGet(url, headers, timeout = HTTP_TIMEOUT) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers, timeout }, (error, response, data) => {
      if (error) reject(new Error(`请求失败: ${error}`));
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

// bit/s → "500 Mbps" (1024 进制)
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

// "17.77 / 540 GB": 单位相同时前一个数省略单位
function formatUsage(used, quota) {
  const [a, b] = [formatBytes(used), formatBytes(quota)];
  const unit = b.split(" ")[1];
  return `${a.endsWith(` ${unit}`) ? a.slice(0, -unit.length - 1) : a} / ${b}`;
}

// 10 格进度条: 用量大于 0 时至少亮 1 格, 用满才亮满 10 格
function usageBar(pct) {
  const filled = Math.min(pct >= 100 ? 10 : 9, Math.max(pct > 0 ? 1 : 0, Math.round(pct / 10)));
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

const formatPct = (pct) => `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;

// 估算一行文字的显示宽度, 以一个汉字的宽度为 1 (面板是比例字体, 只能估算)
// 实测面板一行约能放 17 个汉字宽, 超过 MAX_LINE_WIDTH 就有换行的风险
const MAX_LINE_WIDTH = 15.5;
function estWidth(str) {
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0x1f1e6 && code <= 0x1f1ff) width += 0.65; // 国旗由两个区域指示符组成
    else if (code > 0x2e7f) width += 1; // 汉字等全角字符
    else if (" .·:".includes(ch)) width += 0.28;
    else width += 0.58;
  }
  return width;
}

// 国家 + 城市 (没有城市时用省/州)
function composeRegion(country, place) {
  const parts = [];
  if (country) parts.push(country);
  if (place && place !== country) parts.push(place);
  return parts.join(" ") || null;
}

// 两位国家代码 → 国旗 emoji
function flagOf(code) {
  if (!/^[A-Za-z]{2}$/.test(code || "")) return "";
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// 返回 { region, flag } 或 null
async function getGeo(ip) {
  const key = `vpspanel_geo2_${ip}`;
  let stale = null; // 过期的旧缓存, 查询失败时兜底
  try {
    const cached = $persistentStore.read(key);
    if (cached) {
      const obj = JSON.parse(cached);
      if (obj.region) {
        stale = { region: obj.region, flag: obj.flag || "" };
        if (Date.now() - obj.ts < GEO_CACHE_TTL) return stale;
      }
    }
  } catch (_) {}

  let region = null;
  let flag = "";
  // 主: ip-api.com (中文)
  try {
    const res = await httpGet(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,country,countryCode,regionName,city,query`,
      { Accept: "application/json" },
      GEO_TIMEOUT
    );
    if (res.status === 200) {
      const geo = JSON.parse(res.body);
      if (geo && geo.status === "success") {
        region = composeRegion(geo.country, geo.city || geo.regionName);
        flag = flagOf(geo.countryCode);
      }
    }
  } catch (_) {}

  // 备: ipwho.is (https)
  if (!region) {
    try {
      const res = await httpGet(`https://ipwho.is/${encodeURIComponent(ip)}`, { Accept: "application/json" }, GEO_TIMEOUT);
      if (res.status === 200) {
        const geo = JSON.parse(res.body);
        if (geo && geo.success) {
          region = composeRegion(geo.country, geo.city || geo.region);
          flag = flagOf(geo.country_code);
        }
      }
    } catch (_) {}
  }

  // 只缓存成功结果, 失败下次刷新时重试
  try {
    if (region) $persistentStore.write(JSON.stringify({ region, flag, ts: Date.now() }), key);
  } catch (_) {}
  return region ? { region, flag } : stale;
}

/* ================= 面板 ================= */

function render(info) {
  const ip = MANUAL_IP || info.ip;
  const lines = info.warnings.map((w) => `⚠️ ${w.text}`);

  const shownIp = ip && IP_MODE !== "hide" ? (IP_MODE === "mask" ? maskIp(ip) : ip) : "";
  const whereLine = (region) =>
    [region && `${info.geo.flag ? `${info.geo.flag} ` : ""}${region}`, shownIp].filter(Boolean).join(" · ");
  let where = whereLine(ip && info.geo ? info.geo.region : "");
  // 完整 IP 加上较长的城市名会超出面板宽度, 这时只保留国家
  if (ip && info.geo && estWidth(where) > MAX_LINE_WIDTH) where = whereLine(info.geo.region.split(" ")[0]);
  if (where) lines.push(where);

  if (info.unlimited) lines.push(`已用 ${formatBytes(info.used)} · 不限量`);
  else if (Number.isFinite(info.pct)) lines.push(`${usageBar(info.pct)} ${formatUsage(info.used, info.quota)}`);
  else lines.push(`已用 ${formatBytes(info.used)}`);

  if (Number.isFinite(info.down) && Number.isFinite(info.up)) {
    lines.push(`↓ ${formatBytes(info.down)} · ↑ ${formatBytes(info.up)}`);
  }

  const tail = [];
  if (!info.unlimited && Number.isFinite(info.remaining)) tail.push(`剩余 ${formatBytes(Math.max(0, info.remaining))}`);
  if (Number.isFinite(info.resetAt)) {
    const days = Math.max(0, Math.ceil((info.resetAt - Date.now()) / 86400000));
    tail.push(days > 0 ? `${days} 天后重置` : "今天重置");
  }
  if (tail.length) lines.push(tail.join(" · "));
  return lines.join("\n");
}

function finish(title, content, icon, iconColor) {
  $done({ title, content, icon, "icon-color": iconColor });
}

(async () => {
  const provider = PROVIDERS[PROVIDER_KEY];
  const title = provider ? provider.title : "VPS Server";
  const fail = (msg) => finish(title, `❌ ${msg}`, ERROR_ICON, ERROR_COLOR);
  try {
    if (!provider) return fail(`未知的服务商 provider=${PROVIDER_KEY || "(空)"}`);
    if (provider.requireId && !SERVER_ID) return fail("请在模块参数中填写 id");
    if (!API_TOKEN) return fail("请在模块参数中填写 token");

    const info = await provider.fetch();
    const ip = MANUAL_IP || info.ip;
    // 地区反查(带缓存, 失败不阻塞)
    info.geo = ip ? await getGeo(ip) : null;
    // 用量百分比: 优先用接口给的, 否则自己算; 不限量或额度未知时为 NaN
    info.pct =
      info.unlimited || !(info.quota > 0)
        ? NaN
        : Number.isFinite(info.usedPercent)
          ? info.usedPercent
          : (info.used / info.quota) * 100;

    const level = info.warnings.some((w) => w.level === "error")
      ? "error"
      : info.warnings.length
        ? "warn"
        : null;
    const usageColor = info.pct >= 90 ? ERROR_COLOR : info.pct >= 70 ? WARN_COLOR : PANEL_ICON_COLOR;
    finish(
      Number.isFinite(info.pct) ? `${provider.name} · ${formatPct(info.pct)}` : title,
      render(info),
      level ? ERROR_ICON : PANEL_ICON,
      level === "error" ? ERROR_COLOR : level === "warn" ? WARN_COLOR : usageColor
    );
  } catch (e) {
    fail(String((e && e.message) || e));
  }
})();
