/* iKuuu 每日签到 V1.3 · Yjwj205 / 许舟（Surge 移植） */
(function(){'use strict';
const raw=typeof $argument==='string'?$argument:'', p=raw.split('|');
const empty=v=>!v||/^(?:-|none|null)$/i.test(v.trim());
const on=v=>! /^(?:0|false|off|no|关|否|关闭)$/i.test(String(v||'').trim());
const read=k=>$persistentStore.read(k)||'';
const load=k=>{try{return JSON.parse(read(k))||{};}catch(_){return {};}};
const save=(k,o)=>{if(!$persistentStore.write(JSON.stringify(o),k))throw Error('storage');};
const hostOf=v=>{v=String(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0];return /^(?:[a-z0-9-]+\.)*ikuuu\.(?:org|pw|me)$/.test(v)?v:'';};
const day=ms=>{const d=new Date(ms);return [d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');};
// Non-reversible comparison tag; keep the session value only in the original credential slot.
function tag(s){let keys=s.split(';').map(x=>x.trim()).filter(x=>/^(?:auth|uid|key|email|expire_in|session|remember_[^=;]+)=/i.test(x)).sort();const v=keys.length?keys.join(';'):s;let a=2166136261,b=5381;for(let i=0;i<v.length;i++){a=Math.imul(a^v.charCodeAt(i),16777619);b=Math.imul(b,33)^v.charCodeAt(i);}return (a>>>0).toString(36)+'.'+(b>>>0).toString(36);}
function dailyDue(expr,now){const m=/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/.exec(expr||'');let d=new Date(now);return !!m && +m[1]<60 && +m[2]<24 && d.getHours()*60+d.getMinutes()>=+m[2]*60+ +m[1];}
function result(kind,msg){if(on(p[1])){try{$notification.post('iKuuu 签到',kind,msg);}catch(_){}}try{save('ikuuu_last_result',{t:new Date().toLocaleString(),s:kind,c:msg,k:kind==='签到成功'?'good':'info'});}catch(_){} }
function request(method,url,cookie,node){return new Promise((resolve,reject)=>{const opts={url,timeout:10,'auto-redirect':false,'auto-cookie':false,headers:{Cookie:cookie,Referer:url.split('/user')[0]+'/user',Accept:method==='post'?'application/json':'text/html'}};if(node)opts.policy=node;if(method==='post'){opts.headers.Origin=url.split('/user')[0];opts.headers['X-Requested-With']='XMLHttpRequest';opts.headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';} $httpClient[method](opts,(err,r,body)=>err?reject(Error('network')):resolve({code:Number(r&&r.status),headers:r&&r.headers||{},body:String(body||'')}));});}
function header(r,k){const n=Object.keys(r.headers).find(x=>x.toLowerCase()===k);return n?String(r.headers[n]):'';}
function classify(r){const c=r.code;let j;try{j=JSON.parse(r.body);}catch(_){}const msg=j&&typeof j.msg==='string'?j.msg:'';
 if(c===401 || (c>=300&&c<400&&/\/(?:auth\/)?login(?:[/?#]|$)/i.test(header(r,'location'))) || (c===200&&(/请(?:重新|先)登[录陸]|未登[录陸]|登录(?:已)?(?:过期|失效)/.test(msg)||(!j&&/<form\b[^>]*action=["'][^"']*(?:\/auth\/login|\/login)["']/i.test(r.body)))))return 'auth';
 if(c===429)return 'limit';if(c===403)return 'blocked';if(c!==200)return 'retry';
 if(j&&(j.ret===1||j.ret==='1'))return 'success';if(j&&/(?:已(?:经)?签到|已经?签过|重复签到|签到过了|明天再来)/.test(msg))return 'already';return 'retry';}
async function main(){if(!on(p[3]))return;const now=Date.now(),today=day(now),loop=p[5]==='loop';
 const origin=hostOf(read('ikuuu_site_host')),fixed=hostOf(p[4]),host=fixed||origin||'ikuuu.org',base='https://'+host;
 const key='ikuuu_recovery_v13_'+host, st=load(key);
 if(st.lock>now||st.next>now)return;
 if(loop&&st.open!==today&&!st.wait&&!dailyDue(p[6],now))return;
 const manual=empty(p[0])?'':p[0].trim().replace(/^cookie:\s*/i,'');const saved=origin===host?read('ikuuu_org_cookie'):'';
 const captured=Number(read('ikuuu_capture_time_v13'))||0;
 const m=manual?tag(manual):'',s=saved?tag(saved):'';
 let cookie=manual && m!==st.badManual?manual: saved && s!==st.badSaved && s!==st.badManual && (!manual||captured>=st.manualInvalidAt)?saved:'';
 if(!cookie||/[\r\n]/.test(cookie)){st.open=today;st.wait=true;if(!st.warn){st.warn=true;save(key,st);result('等待重新登录','请在 Safari 登录 iKuuu 并打开用户中心。抓到新 Cookie 后会自动补签。');}else save(key,st);return;}
 const fp=tag(cookie);if(st.done===today&&st.doneTag===fp)return;if(st.triesDay!==today||st.triesTag!==fp){st.tries=0;st.triesDay=today;st.triesTag=fp;}
 if(st.tries>=5)return;st.open=today;st.lock=now+60000;st.tries++;save(key,st);
 let r,kind;try{const node=empty(p[2])?'':p[2];r=await request('get',base+'/user',cookie,node);kind=classify(r);
 if(r.code===200 && kind!=='auth'){
 const html=extractHtml(r.body);const box=html.match(/<div\b[^>]*\bid=["']checkin-div["'][^>]*>([\s\S]{0,2500}?)<\/div>/i);
 const action=box && box[1].match(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/i);kind='unknown';
 if(action){const label=action[3].replace(/<[^>]+>/g,'').replace(/\s+/g,'');const disabled=/\bdisabled\b/i.test(action[2]);
 if(disabled && /明[日天]再来|已(?:经)?签到|已签过/.test(label))kind='skip';
 else if(!disabled && (/^(?:(?:今日|每日|立即|点击)?签到(?:领(?:取)?流量)?|未签到)$/.test(label)||(/\bid=["']checkin["']/i.test(action[2])&&/签到/.test(label)))){r=await request('post',base+'/user/checkin',cookie,node);kind=classify(r);}}
 }
 }catch(_){kind='retry';}
 if(kind==='skip'){st.lock=0;st.done=today;st.doneTag=fp;st.wait=false;st.warn=false;st.next=0;st.tries=0;save(key,st);console.log('[iKuuu] 官网已签，跳过提交');return;}
 st.lock=0;
 if(kind==='success'||kind==='already'){st.done=today;st.doneTag=fp;st.wait=false;st.warn=false;st.next=0;st.tries=0;save(key,st);
 let msg=String((JSON.parse(r.body)||{}).msg||'今日签到已确认').slice(0,180);try{const q=await request('get',base+'/user',cookie,empty(p[2])?'':p[2]);if(q.code===200){const v=pick(extractHtml(q.body),'剩余流量');if(v)msg+='\n剩余流量：'+v;}}catch(_){} result(kind==='success'?'签到成功':'今日已签到',msg);return;}
 if(kind==='auth'){if(cookie===manual){st.badManual=fp;st.manualInvalidAt=Date.now();}else st.badSaved=fp;st.wait=true;const warn=!st.warn;st.warn=true;save(key,st);if(warn)result('Cookie 已失效','请在 Safari 重新登录 '+host+' 并进入用户中心。旧 Cookie 不再重试。');return;}
 let seconds=Math.min(7200,600*Math.pow(2,st.tries-1));if(kind==='limit'){let h=header(r,'retry-after');const t=/^\d+$/.test(h)?Number(h):(Date.parse(h)-now)/1000;seconds=Math.max(1800,seconds,Number.isFinite(t)?t:0);}if(kind==='blocked')st.tries=5;
 st.next=Date.now()+seconds*1000;save(key,st);if(st.tries===1||st.tries>=5)result('签到未确认',kind==='blocked'?'站点拒绝访问，请在官网检查；今天不再自动尝试。':st.tries>=5?'本日重试已达上限。':'本次未收到签到确认，稍后自动重试。');}
  var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function utf8Decode(bytes) {
    var out = "", i = 0;
    while (i < bytes.length) {
      var b = bytes[i++];
      if (b < 0x80) {
        out += String.fromCharCode(b);
      } else if (b >= 0xC0 && b < 0xE0) {
        out += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i++] & 0x3F));
      } else if (b >= 0xE0 && b < 0xF0) {
        out += String.fromCharCode(((b & 0x0F) << 12) |
          ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F));
      } else {
        var cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3F) << 12) |
          ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
        cp -= 0x10000;
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
      }
    }
    return out;
  }

  function base64Decode(str) {
    str = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
    var bytes = [], buf = 0, bits = 0, i, v;
    for (i = 0; i < str.length; i++) {
      if (str.charAt(i) === "=") break;
      v = B64_CHARS.indexOf(str.charAt(i));
      if (v < 0) continue;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buf >> bits) & 0xFF);
      }
    }
    return utf8Decode(bytes);
  }

  function extractHtml(data) {
    var text = String(data || "");
    var m = text.match(/var\s+originBody\s*=\s*["']([^"']+)["']/);
    if (!m) return text;
    try {
      return base64Decode(m[1]);
    } catch (e) {
      return text;
    }
  }

  function pick(html, label) {
    var re = new RegExp(
      label + "[\\s\\S]{0,400}?<span[^>]*class=\"[^\"]*counter[^\"]*\"[^>]*>" +
      "\\s*([\\d.]+)\\s*<\\/span>\\s*([KMGTP]?B)", "i");
    var m = html.match(re);
    if (m) return m[1] + " " + m[2].toUpperCase();
    var plain = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    var m2 = plain.match(new RegExp(label + "\\s*[:：]?\\s*([\\d.]+)\\s*([KMGTP]?B)", "i"));
    return m2 ? m2[1] + " " + m2[2].toUpperCase() : null;
  }


if(typeof module!=='undefined'&&module.exports)module.exports={classify,tag,dailyDue};
if(typeof $done==='function')main().then(()=>$done(),()=>{console.log('[iKuuu] 状态存储或执行失败');$done();});
}());
