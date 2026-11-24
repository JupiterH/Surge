/**
 * iKuuu Cookie 抓取（Surge 版 · http-request 脚本）
 *
 * 移植自 Yjwj205/loon-modules 的 iKuuu 插件（Loon → Surge API 转换）
 *
 * 作用：已登录状态下打开 ikuuu.org 时，把请求头里的 Cookie 存进 Surge 本地存储，
 *      供 ikuuu-checkin.js 签到使用。
 *
 * 参数（模块参数表按竖线拼接）：
 *   capture ｜ 抓取开关，false 时本脚本直接放行不做事
 *   notify  ｜ 抓取成功后是否发通知，默认 true
 *
 * 注意：
 *   - 模块里的「抓取 Cookie」关掉后本脚本不再写入，已保存的 Cookie 仍然可用；
 *   - 只有登录后才会出现的会话 Cookie（auth / uid+key / session 等）才会保存，
 *     游客 Cookie（如 __cf_bm）不会覆盖已保存的值；
 *   - 需要 Surge 开启 MITM 且已安装信任证书（模块已声明 hostname = ikuuu.org）；
 *   - 脚本只读 Cookie、不修改请求，最后 $done({}) 原样放行。
 */
(function () {
  "use strict";

  var COOKIE_KEY = "ikuuu_org_cookie";
  var HOST_KEY = "ikuuu_site_host";
  var KNOWN_HOST = /^(?:[a-z0-9-]+\.)*ikuuu\.(?:org|pw|me)$/i;
  var LOGIN_COOKIE = /(?:^|;\s*)(?:auth|uid|key|session|remember_[^=;]*)=[^;]/i;

  function isOff(value) {
    var s = String(value === null || value === undefined ? "" : value).trim().toLowerCase();
    if (s === "") return false;
    return s === "0" || s === "false" || s === "off" || s === "no" ||
      s === "关" || s === "否" || s === "关闭";
  }

  function onByDefault(value) {
    var s = String(value === null || value === undefined ? "" : value).trim();
    if (s === "") return true;
    return !isOff(s);
  }

  var rawArg = (typeof $argument === "string") ? $argument : "";
  var parts = rawArg.split("|");
  var captureEnabled = onByDefault(parts[0]);
  var notifyEnabled = onByDefault(parts[1]);

  function notify(subtitle, content) {
    if (!notifyEnabled) return;
    try {
      $notification.post("iKuuu Cookie 抓取", subtitle, content);
    } catch (e) {
      console.log("[iKuuu] 通知发送失败：" + e);
    }
  }

  if (!captureEnabled) {
    console.log("[iKuuu] Cookie 抓取已关闭，放行");
    return $done({});
  }

  function findCookie(headers) {
    if (!headers) return "";
    for (var key in headers) {
      if (key && key.toLowerCase() === "cookie" && headers[key]) {
        return String(headers[key]);
      }
    }
    return "";
  }

  var cookie = "";
  try {
    cookie = findCookie($request && $request.headers).trim();
  } catch (e) {
    console.log("[iKuuu] 读取请求头失败：" + e);
  }

  if (!cookie) {
    console.log("[iKuuu] 本次请求没有 Cookie，跳过");
    return $done({});
  }

  if (!LOGIN_COOKIE.test(cookie)) {
    console.log("[iKuuu] 当前是未登录状态，忽略本次 Cookie");
    return $done({});
  }

  var safeHost = /^https:\/\/([^/:?#]+)\/user(?:[/?#]|$)/i.exec(String($request.url || ''));
  if (!safeHost || !KNOWN_HOST.test(safeHost[1]) || !/^GET$/i.test($request.method || 'GET')) return $done({});
  var existing = "";
  try {
    existing = String($persistentStore.read(COOKIE_KEY) || "");
  } catch (e) {}

  if (existing === cookie && String($persistentStore.read(HOST_KEY)||"").toLowerCase() === safeHost[1].toLowerCase()) {
    console.log("[iKuuu] Cookie 没有变化，跳过写入");
    return $done({});
  }

  var saved = false;
  try {
    saved = $persistentStore.write(cookie, COOKIE_KEY);
  } catch (e) {
    console.log("[iKuuu] 保存 Cookie 失败：" + e);
  }

  // 顺手记住这份 Cookie 是从哪个域名登进来的，签到优先用同一个站
  var host = "";
  try {
    var m = String(($request && $request.url) || "").match(/^https?:\/\/([^\/:?#]+)/i);
    host = m ? m[1].toLowerCase() : "";
    if (host && KNOWN_HOST.test(host)) {
      $persistentStore.write(host, HOST_KEY);
    } else {
      host = "";
    }
  } catch (e) {
    console.log("[iKuuu] 记录来源域名失败：" + e);
  }

  if (saved) {
    $persistentStore.write(String(Date.now()), "ikuuu_capture_time_v13");
    console.log("[iKuuu] 已保存登录 Cookie（" + cookie.length + " 字节）" + (host ? "，站点 " + host : ""));
    notify("已获取登录 Cookie",
      (host ? "站点：" + host + "\n" : "") +
      "如有待补签到，下一轮定时检查会自动处理，无需手动运行。");
  } else {
    console.log("[iKuuu] 写入本地存储失败");
    notify("Cookie 保存失败", "写入 Surge 本地存储失败，请检查后重试。");
  }

  $done({});
})();
