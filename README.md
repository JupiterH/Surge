# Surge

自用的 Surge 配置与分流规则。Clash（mihomo）也直接引用这里的规则，见 [JupiterH/Clash](https://github.com/JupiterH/Clash)。

## 目录

| 路径 | 内容 |
|---|---|
| `Xiao.conf` | 主配置（`[General]`、策略组、分流规则） |
| `Rule/` | 自维护的规则集，Surge 与 Clash 共用 |
| `Scripts/` | 自维护脚本 |

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
| `Reject.list` | 拦截修正：芒果TV P2P 信令等 | 拦截（REJECT） |
| `Proxy.list` | 代理修正：GitHub、Bing、Google CN 等 | 未在主配置中引用 |
| `japan.list` | MetaTube 刮削站点 | 未在主配置中引用 |

规则统一写成 `类型,值`，逗号后不加空格；每个文件开头的 `# UPDATED:` 改动时一起更新。

## 免责声明

- 本仓库内容仅供个人学习与研究网络技术使用，不提供任何形式的担保，请勿用于商业或任何违法用途。
- 使用者应自行遵守所在国家或地区的法律法规，因使用本仓库内容产生的任何后果（包括但不限于数据丢失、账号异常、设备故障）由使用者自行承担，作者不承担任何责任。
- 本仓库中部分规则、模块和脚本来自或改编自第三方项目，版权归原作者所有，已尽量在文件内注明来源。如有侵权，请联系作者，核实后会及时删除。
- 规则与脚本可能随上游或目标服务的变化而失效，作者不保证其准确性、完整性和时效性。
- 引用、下载或使用本仓库任何内容，即视为已阅读并同意以上声明。
