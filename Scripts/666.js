// 666Clouds bandwidth panel for Surge iOS
// Set cookie locally using the script argument: cookie=YOUR_COOKIE
const args = Object.fromEntries(($argument || '').split('&').filter(Boolean).map(x => { const p=x.indexOf('='); return [decodeURIComponent(p<0?x:x.slice(0,p)), decodeURIComponent(p<0?'':x.slice(p+1))]; }));
const serviceId = args.id || '填入';
const cookie = args.cookie || $persistentStore.read('666clouds_cookie') || '';
const url = `https://666clouds.com/portal/services/${encodeURIComponent(serviceId)}`;
const finish = (content, title='六六云 VPS') => $done({title, content, icon:'server.rack', 'icon-color':'#3B82F6'});
if (!/^\d+$/.test(serviceId)) finish('实例 ID 无效');
else if (!cookie || cookie === 'PASTE_COOKIE_HERE') finish('请先在模块中配置 Cookie（仅保存在本机）');
else {
  $httpClient.get({url, headers:{Cookie:cookie, Accept:'text/html', 'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile Safari/604.1'}, timeout:15000}, (err, resp, body) => {
    if (err) return finish(`请求失败：${String(err)}`);
    if (!resp || resp.status !== 200) return finish(`HTTP ${(resp && resp.status) || '未知'}，请检查 Cookie`);
    const s=String(body||'');
    if (!s.includes('剩余流量') && !s.includes('\\"flow\\"')) return finish('未找到流量信息：可能需要重新登录');
    // HTML is server-rendered; labels and values are present in markup.
    const htmlMatch=s.match(/剩余流量<\/span><span[^>]*>([^<]+)<\/span>[\s\S]{0,600}?已用\s*([\d.]+\s*[A-Za-z]+)\s*\/\s*([\d.]+\s*[A-Za-z]+)/);
    // Next.js Flight payload contains an escaped JSON flow object in script text.
    const flight=s.match(/\\"flow\\":\{[\s\S]{0,1800}?\\"left\\":\\"([^\\"]+)\\"[\s\S]{0,700}?\\"reset\\":\\"([^\\"]+)\\"/);
    const left=htmlMatch?.[1] || (s.match(/\\"left\\":\\"([^\\"]+)\\"/)||[])[1];
    const used=htmlMatch?.[2] || (s.match(/\\"used\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"[\s\S]{0,100}?\\"limit\\"/)||[])[1];
    const limit=htmlMatch?.[3] || (s.match(/\\"limit\\":\\"([^\\"]+)\\"/)||[])[1];
    const reset=(s.match(/\\"reset\\":\\"([^\\"]+)\\"/)||[])[1] || (s.match(/(20\d\d-\d\d-\d\d\s+\d\d:\d\d\s+UTC\+08)[\s\S]{0,60}?重置/)||[])[1];
    const incoming=(s.match(/\\"in\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"/)||[])[1];
    const outgoing=(s.match(/\\"out\\":\\"([\d.]+\s*(?:GB|TB|MB))\\"/)||[])[1];
    if (!left || !used || !limit) return finish('响应成功，但无法解析流量数据；请检查脚本日志');
    const lines=[`剩余：${left}`, `已用：${used} / ${limit}`];
    if(incoming && outgoing) lines.push(`↓ ${incoming}   ↑ ${outgoing}`);
    if(reset) lines.push(`重置：${reset.replace(' UTC+08','')}`);
    finish(lines.join('\n'));
  });
}
