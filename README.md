# Surge

本仓库收录个人使用的 Surge 配置、分流规则、模块及相关脚本。其中的规则集同时供 Clash（mihomo）引用，详见 [JupiterH/Clash](https://github.com/JupiterH/Clash)。

## 目录结构

| 路径 | 内容 |
|---|---|
| `Xiao.conf` | 主配置文件，包含 `[General]`、策略组与分流规则 |
| `Rule/` | 自行维护的规则集，除 `Reject.list` 外均由 Surge 与 Clash 共用 |
| `Module/` | Surge 模块，包括通用设置、DNS 分流、应用去广告、HTTPDNS 拦截及签到 |
| `Panel/` | 面板模块，包括网络接口信息、VPS 流量、汇率、节假日倒计时及规则匹配耗时 |
| `Scripts/` | 面板模块所依赖的脚本，详见[面板](#面板) |
| `Tools/` | Loon 插件转换工具 `loon2surge.py`，详见[转换工具](#转换工具) |

模块的引用地址为 `https://raw.githubusercontent.com/JupiterH/Surge/main/Module/<文件名>`，面板模块将路径中的 `Module` 替换为 `Panel`。

仓库内容更新后，需在 Surge 中更新相应的模块与外部资源，变更方可生效。

## 主配置

`Xiao.conf` 的分流规则主要引用自 [ruleset.skk.moe](https://ruleset.skk.moe)，并以本仓库 `Rule/` 目录下的规则集作为补充与修正。建议同时启用以下两个模块：

- `Module/General.sgmodule`：提供 skip-proxy、always-real-ip 及 MITM 例外等通用设置。
- `Module/DNS.sgmodule`：将国内主要厂商的域名指向其对应的 DNS 服务器。

使用前，须将策略组中的 `policy-path=订阅链接` 替换为实际的订阅地址。

远程控制相关配置项（`external-controller-access`、`http-api`）包含访问密码，未纳入公开配置。如需启用，请在本机 Surge 中单独添加，配置文件内附有示例注释。

## 规则集

规则集的引用地址为 `https://raw.githubusercontent.com/JupiterH/Surge/main/Rule/<文件名>`。

| 文件 | 用途 | 主配置中的策略 |
|---|---|---|
| `Direct.list` | 直连修正：个人域名、VPS 服务商官网、直播源、Steam 下载、淘宝 IP | 直连 |
| `us.list` | 须经美国节点访问的服务（Claude、Muse AI、Ultra Mobile） | 美国 |
| `adobe.list` | Adobe 系列产品（源自 blackmatrix7） | Adobe 策略组 |
| `paypal.list` | PayPal（源自 blackmatrix7） | 美国 |
| `Reject.list` | 拦截修正：芒果 TV 的 P2P 信令等，用于避免其持续占用上行带宽。该文件使用了 `DOMAIN-WILDCARD` 规则类型，仅适用于 Surge | 拦截（REJECT），须置于 `domestic.conf` 之前 |
| `Proxy.list` | 代理修正：GitHub、Bing、Google CN 等 | 未在主配置中引用 |
| `japan.list` | MetaTube 刮削站点 | 未在主配置中引用 |

规则统一采用 `类型,值` 的格式，逗号后不留空格。修改规则集时，应同步更新文件开头的 `# UPDATED:` 日期。

## 模块

`Module/` 目录下的模块按维护方式分为两类：

- **手动维护**：`General`、`DNS`、`Signin`、`youtube`，直接编辑文件即可。
- **由转换工具生成**：其余去广告、HTTPDNS 拦截、天气增强等模块，其来源记录于各文件开头的 `# 来源` 行。此类模块中未归入 `# 分组` 注释的内容会在每次转换时重新生成，不应手动修改；如需追加自定义内容，应写入某一 `# 分组` 之下，或通过 `Tools/loon2surge.json` 进行配置。

`Signin.sgmodule` 目前仅启用阿里云盘签到，其余脚本及 `[MITM]` 域名均已注释。需要重新获取 Cookie 时，请按文件内的说明恢复相应条目。

## 面板

| 模块 | 脚本 | 内容 |
|---|---|---|
| `VPSPanel.sgmodule` | `Scripts/VPSPanel.js` | Peekabo 与六六云的流量信息：地区与 IP、用量进度条、剩余流量、上下行流量、重置时间 |
| `Rates.sgmodule` | `Scripts/Rates.js` | 人民币对美元、欧元、英镑、港币、日元、韩元、里拉的汇率，每小时刷新一次 |
| `Holiday.sgmodule` | `Scripts/Timecard.js` | 最近三个节假日或纪念日的倒计时；节日当天 8:00 推送一条通知 |
| `interface-info.sgmodule` | [xream/scripts](https://github.com/xream/scripts) | 网络接口的实时速率与流量 |
| `MatchingTime.sgmodule` | [mieqq](https://github.com/mieqq/mieqq) | 实际请求的规则匹配耗时 |

Surge 面板仅支持纯文本，各脚本通过全角空格与固定的字符组合实现内容对齐。

### VPS 面板

服务器 ID 与 API Token 通过模块参数配置，仅保存于本机，不随仓库分发。

| 参数 | 说明 |
|---|---|
| `Peekabo-ID`、`Peekabo-Token` | Peekabo 控制面板中的服务器 ID 与 API Token |
| `666-Token`、`666-ID`、`666-IP` | 六六云的流量 API 密钥。`666-ID` 留空时取账户下的第一台服务器；该接口不返回 IP，如需显示 IP 与地区，须手动填写 `666-IP` |
| `禁用Peekabo`、`禁用666` | 填入 `#` 可关闭对应服务商的面板 |
| `icon`、`icon-color` | 面板图标及其颜色。用量达到 70% 时图标变为橙色，达到 90% 时变为红色 |
| `ip-mode` | IP 的显示方式：`full` 为完整显示，`mask` 为隐去后两段，`hide` 为不显示 |

如需支持新的服务商，在 `VPSPanel.js` 的 `PROVIDERS` 中增加一项，并使其 `fetch()` 返回约定的统一结构。

### 节假日倒计时

节假日与纪念日定义于 `Timecard.js` 开头的 `EVENTS` 数组，脚本在每次运行时依据规则推算日期，无需逐年更新。支持以下四种规则：

| 类型 | 含义 | 示例 |
|---|---|---|
| `solar` | 公历固定日期 | `"10-01"` |
| `lunar` | 农历固定日期 | `"12-30"`（当月不足 30 日时取 29 日） |
| `term` | 二十四节气，以序号表示，小寒为 1 | `7`（清明） |
| `week` | 某月的第 N 个星期几 | `"05-2-0"`（5 月第 2 个星期日） |

## 转换工具

`Tools/loon2surge.py` 用于读取本机 Loon 缓存的插件，将其转换为 Surge 模块并写入 `Module/` 目录，随后提交并推送至远端仓库。运行前须先在 Loon 中更新插件，以确保缓存为最新版本。

```bash
python3 Tools/loon2surge.py [--dry-run | --stale-hosts]
```

| 参数 | 行为 |
|---|---|
| 无 | 执行转换，并提交、推送变更。若此前存在未推送成功的提交，将一并推送 |
| `--dry-run` | 仅输出将产生的变更，不写入文件，不提交 |
| `--stale-hosts` | 列出各模块 `[MITM]` 中已不被任何插件引用的域名，仅作报告，不修改文件 |

转换过程中，`[MITM]` 域名只增不减。插件已移除的域名不会被自动删除，可借助 `--stale-hosts` 的报告人工清理。

模块与插件的对应关系定义于 `Tools/loon2surge.json`，每个插件条目支持以下字段：

| 字段 | 说明 |
|---|---|
| `plugin` | Loon 插件名称，必填 |
| `label` | 分组名称。同一模块合并多个插件时必填，转换结果写入各段的 `# label` 分组之下 |
| `prefix` | 脚本名称前缀，用于避免不同模块间的脚本重名；缺省时取 `label` 的值 |
| `fixes` | 转换完成后执行的文本替换，用于修正插件中的错误 |
| `rule_suffix` | 附加于域名类拦截规则末尾的参数，例如 `,extended-matching,pre-matching` |
| `extra_hosts` | 插件未声明但实际需要的 MITM 域名 |

遇到无法识别的 Loon 语法时，工具将报错并终止，不会写入或推送任何文件。若系统已安装 `jq`，工具还会校验所生成的 jq 表达式能否通过编译。

## 免责声明

- 本仓库内容仅供个人学习与研究网络技术使用，不提供任何形式的担保，请勿用于商业或任何违法用途。
- 使用者应自行遵守所在国家或地区的法律法规，因使用本仓库内容产生的任何后果（包括但不限于数据丢失、账号异常、设备故障）由使用者自行承担，作者不承担任何责任。
- 本仓库中部分规则、模块和脚本来自或改编自第三方项目，版权归原作者所有，已尽量在文件内注明来源。如有侵权，请联系作者，核实后会及时删除。
- 规则与脚本可能随上游或目标服务的变化而失效，作者不保证其准确性、完整性和时效性。
- 引用、下载或使用本仓库任何内容，即视为已阅读并同意以上声明。
