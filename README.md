# Surge

自用的 Surge 配置、分流规则、模块和面板。Clash（mihomo）也直接引用这里的规则，见 [JupiterH/Clash](https://github.com/JupiterH/Clash)。

## 目录

| 路径 | 内容 |
|---|---|
| `Xiao.conf` | 主配置（`[General]`、策略组、分流规则） |
| `Rule/` | 自维护的规则集，Surge 与 Clash 共用 |
| `Module/` | 功能模块与去广告模块 |
| `Panel/` | 面板模块 |
| `Scripts/` | 面板和模块用到的自维护脚本 |
| `Tools/` | Loon 插件转 Surge 模块的工具 |

## 主配置

`Xiao.conf` 的规则大部分来自 [ruleset.skk.moe](https://ruleset.skk.moe)，再加上本仓库 `Rule/` 下的修正规则。建议配合两个模块一起使用：

- `Module/General.sgmodule`：skip-proxy、always-real-ip、MITM 例外
- `Module/DNS.sgmodule`：国内各厂商域名走对应的 DNS

使用前把策略组里的 `policy-path=订阅链接` 换成自己的订阅地址。

远程控制（`external-controller-access`、`http-api`）带访问密码，没有放进公开配置。需要时在本机 Surge 里单独添加，配置文件里有示例注释。

## 规则集

引用地址：`https://raw.githubusercontent.com/JupiterH/Surge/main/Rule/<文件名>`

| 文件 | 用途 | 主配置中的策略 |
|---|---|---|
| `Direct.list` | 直连修正：个人域名、VPS 官网、直播源、Steam 下载、淘宝 IP | 直连 |
| `us.list` | 需要走美国节点的服务（Claude、Muse AI、Ultra Mobile） | 美国 |
| `adobe.list` | Adobe 全家桶（源自 blackmatrix7） | Adobe 策略组 |
| `paypal.list` | PayPal（源自 blackmatrix7） | 美国 |
| `Proxy.list` | 代理修正：GitHub、Bing、Google CN 等 | 未在主配置中引用 |
| `japan.list` | MetaTube 刮削站点 | 未在主配置中引用 |

规则统一写成 `类型,值`，逗号后不加空格；每个文件开头的 `# UPDATED:` 改动时一起更新。

## 模块

功能模块：

| 模块 | 说明 |
|---|---|
| `General.sgmodule` | 增强设置 |
| `DNS.sgmodule` | 本地 DNS 映射 |
| `Signin.sgmodule` | 签到脚本合集 |
| `weather.sgmodule` | Apple 天气增强 |

去广告模块：

| 模块 | 说明 |
|---|---|
| `Antiads.sgmodule` | 拦截各广告平台请求，需置顶 |
| `Httpdns.sgmodule` | 拦截常见 HTTPDNS 服务，需置顶 |
| `ads.sgmodule` | 合集：两步路、小米音箱、淘宝、盒马、菜鸟、得物、京东、彩云天气、小象超市、豆瓣、掌上英雄联盟、12306、什么值得买 |
| `baidu.sgmodule` | 百度贴吧、百度网盘 |
| `read.sgmodule` | 番茄小说等阅读类 |
| `didi.sgmodule` | 滴滴 |
| `gaode.sgmodule` | 高德地图 |
| `keep.sgmodule` | Keep |
| `pdd.sgmodule` | 拼多多 |
| `weibo.sgmodule` | 微博 |
| `weixin.sgmodule` | 微信小程序 |
| `xianyu.sgmodule` | 闲鱼 |
| `xiaoheihe.sgmodule` | 小黑盒 |
| `xiaohongshu.sgmodule` | 小红书（含去水印） |
| `youtube.sgmodule` | YouTube |
| `zhihu.sgmodule` | 知乎 |

去广告模块里的 MITM 和脚本需要在 Surge 中开启 MITM 并信任证书。

## 面板

| 面板 | 说明 |
|---|---|
| `10086.sgmodule` | 中国移动话费流量 |
| `Almanac.sgmodule` | 今日黄历 |
| `Appfree.sgmodule` | App Store 限免 |
| `Book.sgmodule` | 新书速递 |
| `Connectivity.sgmodule` | 连通性测试 |
| `History.sgmodule` | 历史上的今天 |
| `Holiday.sgmodule` | 节假日倒计时（`Scripts/Timecard.js`） |
| `MatchingTime.sgmodule` | 规则匹配耗时统计 |
| `NetInfo.sgmodule` | 当前网络信息 |
| `Ping.sgmodule` | 延迟柱状图 |
| `Rates.sgmodule` | 汇率（`Scripts/Rates.js`） |
| `Speedtest.sgmodule` | 下行速率与延迟测试 |
| `Stream.sgmodule` | 流媒体解锁检测 |
| `VPS.sgmodule` | VPS 流量与负载（`Scripts/VPS.js`） |
| `Weather.sgmodule` | 今日天气 |
| `interface-info.sgmodule` | 网络接口网速和流量 |

## Loon 插件转换工具

`Tools/loon2surge.py` 把 Loon 本地缓存的插件转换成本仓库的 Surge 模块，然后提交并推送。模块和插件的对应关系写在 `Tools/loon2surge.json`。

在 macOS 上、仓库根目录运行：

```bash
python3 Tools/loon2surge.py --dry-run
```

`--dry-run` 只转换并显示改动；不加参数会直接提交并推送。手写的分组内容会保留，转换规则见脚本开头的说明。
