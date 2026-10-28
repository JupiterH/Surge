#!/usr/bin/env python3
"""把 Loon 本地缓存的插件转换成 Surge 模块，写回本仓库并推送。

用法（在仓库根目录运行）：
  python3 Tools/loon2surge.py            转换、提交并推送
  python3 Tools/loon2surge.py --dry-run  只转换并显示改动，不提交

模块和插件的对应关系写在 Tools/loon2surge.json。

规则：
- 每个模块的开头（#!name、#!desc、#!category 等）原样保留，内容有变化时只更新日期。
- 配置里带 label 的插件，内容写在各段的 "# label" 分组下；没有 label 的插件，内容写在各段最前面、不加分组注释。
- 各段里不属于任何插件的 "# 分组"（手写内容）原样保留；没有分组注释的内容视为转换结果，每次重新生成。
- [MITM] 只增不删：保留原有域名，补上插件里新增的域名；插件漏掉的域名写在配置的 extra_hosts 里。
- 配置里的 fixes 在每次转换后做文字替换，rule_suffix 给域名类拦截规则加后缀。
- 遇到不认识的 Loon 写法会报错退出，不会写入或推送任何文件。
"""
import argparse
import base64
import datetime
import fnmatch
import glob
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(REPO, 'Tools', 'loon2surge.json')
DEFAULT_LOON_DIR = '/Library/Application Support/com.loon.Loon/remotePlugin'
CONTENT_SECTIONS = ['[Rule]', '[Body Rewrite]', '[Map Local]', '[Script]']
JSON_HDR = 'header="Content-Type:application/json"'
MIME = {'json': 'application/json', 'text': 'text/plain', 'html': 'text/html'}
REWRITE_LINE = re.compile(r'^(request|response) if \$\{url\} ~= /(.*)/i? then (.*)$')


class ConvertError(Exception):
    pass


def dedupe(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ---------- Loon 插件 -> Surge 片段 ----------

def norm_rule(line):
    """去掉逗号后的空格（引号内除外），去掉不含逗号的值两边的引号。"""
    out, quoted, skip = [], False, False
    for ch in line.rstrip():
        if skip and ch == ' ':
            continue
        skip = False
        if ch == '"':
            quoted = not quoted
        out.append(ch)
        if ch == ',' and not quoted:
            skip = True
    return re.sub(r'"([^",]*)"', r'\1', ''.join(out))


def jq_path(p):
    """Loon 的 a.b[0].c 写法 -> jq 路径 .a.b[0].c；不是标识符的键写成 ["键"]。"""
    out = ''
    for seg in (p[2:] if p.startswith('$.') else p).split('.'):
        m = re.fullmatch(r'(.*?)((?:\[\d+\])*)', seg)
        key, idx = m.group(1), m.group(2)
        if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            out += '.' + key
        elif key:
            out += ('' if out else '.') + '[' + json.dumps(key, ensure_ascii=False) + ']'
        out += idx if out else '.' + idx
    return out


def jq_value(v):
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
            if isinstance(parsed, (dict, list)):
                return json.dumps(parsed, ensure_ascii=False)
        except ValueError:
            pass
    return json.dumps(v, ensure_ascii=False)


def as_list(v):
    return v if isinstance(v, list) else [v]


def parse_argument(line):
    """[Argument] 一行 -> (key, 默认值, 说明)。"""
    m = re.match(r'^([^=\s]+)\s*=\s*(select|input|switch)\s*,(.*)$', line)
    if not m:
        raise ConvertError('看不懂的 [Argument]：' + line)
    key, kind, rest = m.groups()
    pre, _, post = rest.partition('tag=')
    tag = re.split(r',\s*desc=', post, maxsplit=1)[0].strip() if post else ''
    if kind == 'switch':
        values = re.findall(r'\b(true|false)\b', pre)
    else:
        values = re.findall(r'"([^"]*)"', pre)
    default = values[0] if values else ''
    desc = f'{key}：{tag or key}'
    if kind == 'select' and len(values) > 1:
        desc += '，可选 ' + ' / '.join(values)
    elif kind == 'switch':
        desc += '，可选 true / false'
    return key, default if default != '' else '""', desc


def map_local(pattern, action):
    if re.fullmatch(r'reject_dict(\(200\))?', action):
        return f'{pattern} data-type=text data="{{}}" status-code=200 {JSON_HDR}'
    if re.fullmatch(r'reject_array(\(200\))?', action):
        return f'{pattern} data-type=text data="[]" status-code=200 {JSON_HDR}'
    if re.fullmatch(r'reject_img(\(200\))?', action):
        return f'{pattern} data-type=tiny-gif status-code=200'
    if re.fullmatch(r'reject(\(404\))?', action):
        return f'{pattern} data-type=text data=" " status-code=404'
    if re.fullmatch(r'reject(_200|\(200\))', action):
        return f'{pattern} data-type=text data=" " status-code=200'
    m = re.fullmatch(r'response\.body\.mock\("(\w+)",\s*("(?:[^"\\]|\\.)*"),\s*(\d+)\)', action)
    if m:
        kind, body, status = m.group(1), json.loads(m.group(2)), m.group(3)
        data = base64.b64encode(body.encode('utf-8')).decode()
        hdr = f' header="Content-Type:{MIME[kind]}"' if kind in MIME else ''
        return f'{pattern} data-type=base64 data="{data}" status-code={status}{hdr}'
    return None


def convert_plugin(name, text, prefix):
    """返回 ({段名: [行]}, [MITM 域名], [(参数名, 默认值, 说明)], {插件元信息})。"""
    meta, out, hosts, args = {}, {s: [] for s in CONTENT_SECTIONS}, [], []
    script_names = {}
    section = None
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith('#!'):
            k, _, v = line[2:].partition('=')
            meta[k.strip()] = v.strip()
            continue
        if line.startswith('['):
            section = line
            continue
        if not line or line.startswith('#'):
            continue
        where = f'「{name}」{section}：{line}'
        if section == '[Argument]':
            args.append(parse_argument(line))
        elif section == '[Rule]':
            out['[Rule]'].append(norm_rule(line))
        elif section in ('[MitM]', '[MITM]'):
            k, _, v = line.partition('=')
            if k.strip().lower() == 'hostname':
                hosts += [h.strip() for h in v.split(',') if h.strip()]
        elif section in ('[Rewrite]', '[Script]'):
            m = REWRITE_LINE.match(line)
            if not m:
                raise ConvertError('看不懂的写法 ' + where)
            kind, pattern, action = m.groups()
            if ' ' in pattern:
                raise ConvertError('正则里有空格，Surge 写不了 ' + where)
            ml = map_local(pattern, action)
            if ml:
                out['[Map Local]'].append(ml)
                continue
            jm = re.fullmatch(r'(request|response)\.json\.(jq|jq_file|delete|replace)\((.*)\)', action)
            if jm:
                fn, arg = jm.group(2), jm.group(3)
                if fn == 'jq_file':
                    out['[Body Rewrite]'].append(f'http-{kind}-jq {pattern} jq-path="{json.loads(arg)}"')
                    continue
                if fn == 'jq':
                    expr = json.loads(arg)
                elif fn == 'delete':
                    expr = 'del(' + ', '.join(jq_path(p) for p in dedupe(as_list(json.loads(arg)))) + ')'
                else:
                    paths, vals = json.loads('[' + arg + ']')
                    expr = ' | '.join(f'{jq_path(p)} = {jq_value(v)}' for p, v in zip(as_list(paths), as_list(vals)))
                if "'" in expr:
                    raise ConvertError('jq 表达式里有单引号，Surge 写不了 ' + where)
                out['[Body Rewrite]'].append(f"http-{kind}-jq {pattern} '{expr}'")
                continue
            sm = re.fullmatch(r'script\("([^"]+)"(?:\s*,\s*(\{.*\}))?\)\s+with\s+(.*)', action)
            if not sm:
                raise ConvertError('看不懂的写法 ' + where)
            url, arg_block, opts = sm.groups()
            o = dict((k, v.strip().strip('"')) for k, v in re.findall(r'(\w+)=("[^"]*"|[^,]+)', opts))
            tag = o.pop('tag', 'script')
            script_names[tag] = script_names.get(tag, 0) + 1
            if script_names[tag] > 1:
                tag = f'{tag}{script_names[tag]}'
            parts = [f'type=http-{kind}', 'pattern=' + (f'"{pattern}"' if ',' in pattern else pattern)]
            if o.pop('requires_body', 'false') == 'true':
                parts.append('requires-body=1')
            if o.pop('binary_body_mode', 'false') == 'true':
                parts.append('binary-body-mode=1')
            if 'timeout' in o:
                parts.append('timeout=' + o.pop('timeout'))
            if o:
                raise ConvertError(f'看不懂的脚本参数 {sorted(o)} ' + where)
            parts.append('script-path=' + url)
            if arg_block:
                keys = re.findall(r'\$\{([^}]+)\}', arg_block)
                if not keys:
                    raise ConvertError('看不懂的脚本传参 ' + where)
                parts.append('argument="' + '&'.join(f'{k}={{{{{{{k}}}}}}}' for k in keys) + '"')
            out['[Script]'].append((f'{prefix}-{tag}' if prefix else tag) + ' = ' + ', '.join(parts))
        else:
            raise ConvertError(f'不支持的段 {section}：「{name}」')
    out['[Rule]'] = dedupe(out['[Rule]'])
    out['[Map Local]'] = dedupe(out['[Map Local]'])
    return out, dedupe(hosts), args, meta


def check_jq(lines):
    if not shutil.which('jq'):
        return
    for line in lines:
        m = re.match(r"^http-\w+-jq \S+ '(.*)'$", line)
        if not m:
            continue
        r = subprocess.run(['jq', m.group(1)], input='{}', capture_output=True, text=True)
        if any(s in r.stderr for s in ('compile', 'syntax error', 'Invalid path expression')):
            raise ConvertError('jq 表达式有问题：' + line[:120] + '\n' + r.stderr.strip())


# ---------- 合并进现有模块 ----------

def split_module(text):
    """-> (开头的行, [(段名, [行])])。"""
    header, sections, cur = [], [], None
    for line in text.splitlines():
        if re.match(r'^\[[^\]]+\]\s*$', line):
            cur = (line.strip(), [])
            sections.append(cur)
        elif cur is None:
            header.append(line)
        else:
            cur[1].append(line)
    while header and not header[-1].strip():
        header.pop()
    return header, sections


def split_groups(lines):
    """-> [(分组名或 None, [行])]，分组以 "# 名字" 开头。"""
    groups = [(None, [])]
    for line in lines:
        if not line.strip():
            continue
        m = re.match(r'^#\s*(.+?)\s*$', line)
        if m and not line.startswith('#!'):
            groups.append((m.group(1), []))
        else:
            groups[-1][1].append(line)
    return [g for g in groups if g[0] is not None or g[1]]


def render_groups(groups):
    out = []
    for label, lines in groups:
        if not lines:
            continue
        if out:
            out.append('')
        if label is not None:
            out.append('# ' + label)
        out += lines
    return out


def merge_arguments(header, plugin_args):
    if not plugin_args:
        return header
    idx = {re.match(r'^#!([\w-]+)', l).group(1): i for i, l in enumerate(header) if re.match(r'^#!([\w-]+)', l)}
    existing, style = [], '#!arguments='
    if 'arguments' in idx:
        line = header[idx['arguments']]
        style = re.match(r'^(#!arguments\s*=\s*)', line).group(1)
        for item in line[len(style):].split(','):
            if ':' in item:
                k, v = item.split(':', 1)
                existing.append((k.strip(), v.strip()))
    values = dict(existing)
    order = [k for k, _ in existing] + [k for k, _, _ in plugin_args if k not in values]
    for k, default, _ in plugin_args:
        values.setdefault(k, default)
    arg_line = style + ','.join(f'{k}:{values[k]}' for k in order)

    old_desc = {}
    desc_style = '#!arguments-desc='
    if 'arguments-desc' in idx:
        line = header[idx['arguments-desc']]
        desc_style = re.match(r'^(#!arguments-desc\s*=\s*)', line).group(1)
        for part in line[len(desc_style):].split('\\n'):
            old_desc[part.split('：', 1)[0]] = part
    new_desc = {k: d for k, _, d in plugin_args}
    desc_line = desc_style + '\\n'.join(old_desc.get(k) or new_desc.get(k) or k for k in order)

    header = list(header)
    for key, line in (('arguments', arg_line), ('arguments-desc', desc_line)):
        if key in idx:
            header[idx[key]] = line
        else:
            header.append(line)
            idx[key] = len(header) - 1
    return header


def set_date(header, today):
    for i, line in enumerate(header):
        m = re.match(r'^(#!(?:date|logtime)\s*=\s*)', line)
        if m:
            header[i] = m.group(1) + today
            return header
    return header + [f'#!date = {today}']


def apply_tweaks(entry, sections):
    """配置里的手动修正：fixes 做文字替换，rule_suffix 给域名类拦截规则加后缀。"""
    for fix in entry.get('fixes', []):
        hit = False
        for name, lines in sections.items():
            for i, line in enumerate(lines):
                if fix['from'] in line:
                    lines[i] = line.replace(fix['from'], fix['to'])
                    hit = True
        if not hit:
            print(f'提示：「{entry["plugin"]}」里已经没有要替换的内容：{fix["from"]}（插件可能已修正，可以从配置里删掉这条）')
    suffix = entry.get('rule_suffix')
    if suffix:
        sections['[Rule]'] = [l + suffix if re.fullmatch(r'(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD),[^,]+,REJECT(-DROP)?', l) else l
                              for l in sections['[Rule]']]


def build_module(path, entries, plugins, today):
    """返回新的文件内容（没有变化时和原文件一样）。"""
    converted = []
    for e in entries:
        if e['plugin'] not in plugins:
            raise ConvertError(f'Loon 缓存里找不到插件「{e["plugin"]}」，请先在 Loon 里更新一次插件')
        _, text = plugins[e['plugin']]
        prefix = e.get('prefix', e.get('label'))
        sections, hosts, args, meta = convert_plugin(e['plugin'], text, prefix)
        apply_tweaks(e, sections)
        hosts = dedupe(hosts + e.get('extra_hosts', []))
        converted.append((e.get('label'), (sections, hosts, args, meta)))
    unlabeled = [lab for lab, _ in converted if lab is None]
    if unlabeled and len(converted) > 1:
        raise ConvertError(f'{path}：有多个插件时每个都要写 label')
    managed = {lab for lab, _ in converted}

    full = os.path.join(REPO, path)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else ''
    if old:
        header, sections = split_module(old)
    else:
        meta = converted[0][1][3]
        header = [f'#!name = {meta.get("name", "")}', f'#!desc = {meta.get("desc", "")}',
                  '#!category = 𝑨𝒏𝒕𝒊-𝑨𝑫', f'#!date = {today}']
        sections = []

    plugin_args = [a for _, c in converted for a in c[2]]
    header = merge_arguments(header, plugin_args)

    names = [s for s, _ in sections]
    for i, s in enumerate(CONTENT_SECTIONS):
        if s not in names and any(c[0][s] for _, c in converted):
            later = [n for n in CONTENT_SECTIONS[i + 1:] + ['[MITM]'] if n in names]
            pos = names.index(later[0]) if later else len(names)
            sections.insert(pos, (s, []))
            names.insert(pos, s)

    new_sections = []
    for name, lines in sections:
        if name == '[MITM]':
            hosts = []
            for line in lines:
                k, _, v = line.partition('=')
                if k.strip().lower() == 'hostname':
                    hosts += [h.strip() for h in v.replace('%APPEND%', '').split(',') if h.strip()]
            for _, c in converted:
                for h in c[1]:
                    if not any(fnmatch.fnmatch(h, x) for x in hosts):
                        hosts.append(h)
            new_sections.append((name, ['hostname = %APPEND% ' + ', '.join(hosts)] if hosts else []))
            continue
        if name not in CONTENT_SECTIONS:
            kept = list(lines)
            while kept and not kept[0].strip():
                kept.pop(0)
            while kept and not kept[-1].strip():
                kept.pop()
            new_sections.append((name, kept))
            continue
        groups = split_groups(lines)
        out = [(None, c[0][name]) for lab, c in converted if lab is None]
        placed = set()
        for label, glines in groups:
            if label is None:
                continue  # 没有分组注释的内容 = 上次的转换结果，重新生成
            if label in managed:
                if label not in placed:
                    out += [(label, c[0][name]) for lab, c in converted if lab == label]
                    placed.add(label)
            else:
                out.append((label, glines))
        out += [(lab, c[0][name]) for lab, c in converted if lab is not None and lab not in placed]
        new_sections.append((name, render_groups(out)))

    if '[MITM]' not in [s for s, _ in new_sections]:
        hosts = dedupe([h for _, c in converted for h in c[1]])
        if hosts:
            new_sections.append(('[MITM]', ['hostname = %APPEND% ' + ', '.join(hosts)]))

    for _, c in converted:
        check_jq(c[0]['[Body Rewrite]'])

    def render(hdr):
        out = list(hdr)
        for name, lines in new_sections:
            if lines:
                out += ['', name] + lines
        return '\n'.join(out) + '\n'

    text = render(header)
    if text != old:
        text = render(set_date(header, today))
    return text, [(e['plugin'], c[3].get('date', '')) for e, (_, c) in zip(entries, converted)]


# ---------- 主流程 ----------

def git(*args, check=True):
    return subprocess.run(['git', '-C', REPO, *args], check=check, capture_output=True, text=True).stdout


def load_plugins(loon_dir):
    plugins = {}
    for path in sorted(glob.glob(os.path.join(loon_dir, '*'))):
        try:
            text = open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, IsADirectoryError):
            continue
        m = re.search(r'^#!name\s*=\s*(.+?)\s*$', text, re.M)
        if m:
            plugins[m.group(1)] = (path, text)
    return plugins


def main():
    ap = argparse.ArgumentParser(description='把 Loon 插件转换成 Surge 模块并推送')
    ap.add_argument('--dry-run', action='store_true', help='只写文件并显示改动，不提交、不推送')
    opts = ap.parse_args()

    config = json.load(open(CONFIG, encoding='utf-8'))
    loon_dir = config.get('loon_plugin_dir', DEFAULT_LOON_DIR)
    if not os.path.isdir(loon_dir):
        sys.exit(f'找不到 Loon 插件缓存目录：{loon_dir}')

    if git('status', '--porcelain', '--', 'Module').strip():
        sys.exit('Module 目录里有没提交的改动，请先处理（git status 查看）')
    if not opts.dry_run:
        print('拉取最新代码…')
        git('pull', '--ff-only')

    plugins = load_plugins(loon_dir)
    today = datetime.date.today().isoformat()
    results = {}
    try:
        for path, entries in config['modules'].items():
            results[path] = build_module(path, entries, plugins, today)
    except ConvertError as e:
        sys.exit('转换失败，没有写入任何文件：\n' + str(e))

    changed = []
    for path, (text, sources) in results.items():
        full = os.path.join(REPO, path)
        old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
        if text != old:
            with open(full, 'w', encoding='utf-8') as f:
                f.write(text)
            changed.append((path, sources))

    if not changed:
        print('所有模块都已是最新，没有改动。')
        return
    print('有改动的模块：')
    for path, sources in changed:
        print(f'  {path}  ←  ' + '、'.join(f'{n}({d[:10]})' for n, d in sources))
    print(git('diff', '--stat'))
    if opts.dry_run:
        print('这是试运行，没有提交。查看改动：git diff；放弃改动：git checkout -- Module')
        return

    msg = 'Update modules from Loon plugins\n\n' + '\n'.join(
        f'- {os.path.basename(p)}: ' + ', '.join(n for n, _ in s) for p, s in changed)
    git('add', '--', *[p for p, _ in changed])
    git('commit', '-q', '-m', msg)
    print('推送中…')
    git('push', '-q')
    print('完成：' + git('log', '-1', '--format=%h %s').strip())


if __name__ == '__main__':
    main()
