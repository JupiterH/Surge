/***********************************

ScriptName        知乎净化助手[墨鱼版]
Author            @ddgksf2013, @blackmatrix7, @paynexss
ForHelp           若有屏蔽广告的需求，可公众号后台回复APP名称
WechatID          墨鱼手记
TgChannel         https://t.me/ddgksf2021
Contribute        https://t.me/ddgksf2013_bot
Feedback          📮 ddgksf2013@163.com 📮
UpdateTime        2024-02-17
Suitable          自行观看“# ”注释内容
Attention         如需引用请注明出处，谢谢合作！
ScriptURL         https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js

[rewrite_local]
# 知乎_拦截DNS解析@blackmatrix7
^https?:\/\/118\.89\.204\.198 url reject-dict
^https?:\/\/103\.41\.167\.237 url reject-dict
^https?:\/\/2402:4e00:1200:ed00:0:9089:6dac:96b6 url reject-200
# 知乎_屏蔽远程配置@blackmatrix7
^https?:\/\/api\.zhihu\.com\/ab\/api\/v1\/products\/zhihu\/platforms\/ios\/config url reject-dict
# 知乎_我的页面开通会员CARD@ddgksf2013
^https?:\/\/api\.zhihu\.com\/unlimited/go/my_card url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_开屏广告@ddgksf2013
^https?:\/\/api\.zhihu\.com\/commercial_api.*launch_v2 url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_品牌提问广告@blackmatrix7
^https?:\/\/api\.zhihu\.com\/brand\/question\/\d+/card\? url reject-dict
^https?:\/\/www\.zhihu\.com\/api\/v\d+\/brand\/question/\d+/card\? url reject-dict
# 知乎_去除底部标签页关注人角标@blackmatrix7
^https?:\/\/api\.zhihu\.com\/moments\/tab_v2 url reject-dict
# 知乎_去除消息通知角标@blackmatrix7
^https?:\/\/api\.zhihu\.com\/(notifications\/v\d\/count) url reject-dict
# 知乎_拦截回答下的卡片广告@blackmatrix7
^https?:\/\/www\.zhihu\.com\/api\/v\d\/answers\/\d+\/recommendations url reject-dict
# 知乎_拦截应用内弹窗@blackmatrix7
^https?:\/\/api\.zhihu\.com\/me\/guides url reject-dict
# 知乎_去除关注页最常访问@blackmatrix7
^https?:\/\/api\.zhihu\.com\/moments\/recent url reject-dict
# 知乎_拦截推荐页顶部广告@blackmatrix7
^https?:\/\/api\.zhihu\.com\/api\/v4\/ecom_data\/config url reject-dict
# 知乎_底栏加号的广告@blackmatrix7
^https?:\/\/api\.zhihu\.com\/content-distribution-core\/bubble\/common\/settings url reject-dict
# 知乎_推荐页搜索栏左侧图标@blackmatrix7
^https?:\/\/api\.zhihu\.com\/feed\/render\/revisit\/current_reading url reject-dict
# 知乎_疑似推荐页内容更新红点@blackmatrix7
^https?:\/\/api\.zhihu\.com\/feed\/render\/revisit\/tag_config url reject-dict
# 知乎_暂不清楚作用@blackmatrix7
^https?:\/\/api\.zhihu\.com\/commercial_api\/banners_v3\/app_topstory_banner url reject-dict
^https?:\/\/api\.zhihu\.com\/ad-style-service\/request url reject
# 知乎_用户信息@ddgksf2013
^https?:\/\/api\.zhihu\.com\/people/self$ url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_文章页去除底部广告@blackmatrix7
^https?:\/\/www\.zhihu\.com\/api\/v\d\/articles\/\d+\/recommendation url reject-dict
# 知乎_推荐信息流去广告@ddgksf2013
^https?:\/\/api\.zhihu\.com\/topstory\/recommend url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_搜索页去除推广@ddgksf2013
^https?:\/\/api\.zhihu\.com\/search\/preset_words url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_猜你想搜下面条目['猜你想搜'四个字无法去除]@ddgksf2013
^https?:\/\/api\.zhihu\.com\/search\/recommend_query url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_删除会员页面会员购@ddgksf2013
^https?:\/\/api\.zhihu\.com\/bazaar\/vip_tab\/tabs url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_热榜页去除广告@ddgksf2013
^https?:\/\/api\.zhihu\.com\/v2\/topstory\/hot-lists url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_我的页面下方内容@ddgksf2013
^https?:\/\/api\.zhihu\.com\/api\/v4\/profile\/cards url reject-dict
# 知乎_会员页面顶部处理@ddgksf2013
^https?:\/\/api\.zhihu\.com\/bazaar\/vip_tab\/header url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_热榜页去除直播@ddgksf2013
^https?:\/\/api\.zhihu\.com\/drama\/hot-drama-list url reject
# 知乎_回答信息流去广告@ddgksf2013
^https?:\/\/api\.zhihu\.com\/next-data url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_回答页面顶部推广@ddgksf2013
^https?:\/\/www\.zhihu\.com\/api\/v4\/topics\/rank_list\/question\/\d+\/related url reject
# 知乎_问题回答列表@ddgksf2013
^https?:\/\/api\.zhihu\.com\/(v4\/)?questions\/\d+\/feeds url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_回答内容优化@ddgksf2013
^https?:\/\/www\.zhihu\.com\/appview\/v2\/answer\/ url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_会员页面购物处理@ddgksf2013
^https?:\/\/api\.zhihu\.com\/bazaar\/vip_tab\/modules url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_修改用户盐值@blackmatrix7
^https?:\/\/api\.zhihu\.com\/user-credit\/basis url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_消息页@blackmatrix7
^https?:\/\/api\.zhihu\.com\/notifications\/v3\/(message|timeline\/entry\/system_message) url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_首页右下角悬浮窗@blackmatrix7
^https?:\/\/api\.zhihu\.com\/commercial_api\/app_float_layer url reject
# 知乎_关注页面去除今日话题和为您推荐@ddgksf2013
^https?:\/\/api\.zhihu\.com\/moments_v3 url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js
# 知乎_回答页面相关搜索词@ddgksf2013
^https?:\/\/www\.zhihu\.com\/api\/v4\/search\/related_queries\/answer\/ url reject-dict
# 知乎_首页左侧图标@ddgksf2013
^https?:\/\/api\.zhihu\.com\/root\/window url reject-dict
# 知乎_我的页面底部@ddgksf2013
^https?:\/\/www\.zhihu\.com\/appview\/v\d\/zhmore url reject-200
# 知乎_搜索发现@ddgksf2013
https://api.zhihu.com/search/hot_search url script-response-body https://gist.githubusercontent.com/ddgksf2013/d43179d848586d561dbb968dee93bae8/raw/zhihu.js

[mitm] 

hostname = 118.89.204.198,103.41.167.237,2402:4e00:1200:ed00:0:9089:6dac:96b6,www.zhihu.com,api.zhihu.com,zhuanlan.zhihu.com,appcloud2.zhihu.com,m-cloud.zhihu.com,103.41.167.236,103.41.167.234,103.41.167.235,103.41.167.226


***********************************/






const version = 'V1.0.73';


let body=$response.body;if(body){switch(!0){case/appview\/v2\/answer/.test($request.url):break;case/com\/moments_v3/.test($request.url):try{let e=JSON.parse(body);e.data=e.data.filter(e=>!("pin_publish_entry"==e.type||"recommend_user_card_list"==e.type)),body=JSON.stringify(e)}catch(t){console.log("zhihu user-credit"+t)}break;case/notifications\/v3/.test($request.url):try{let a=JSON.parse(body),r=[];for(let i of a.data)if("官方帐号消息"===i.detail_title){let o=i.unread_count;o>0?i.content.text="未读消息"+o+"条":i.content.text="全部消息已读",i.is_read=!0,i.unread_count=0,r.push(i)}else"活动助手"!==i.detail_title&&r.push(i);a.data=r,body=JSON.stringify(a)}catch(s){console.log("zhihu notifications"+s)}break;case/user-credit\/basis/.test($request.url):try{let d=JSON.parse(body);d.credit_basis.total_score=998,body=JSON.stringify(d)}catch(c){console.log("zhihu user-credit"+c)}break;case/bazaar\/vip_tab\/modules/.test($request.url):try{let l=JSON.parse(body);l.data=l.data.filter(e=>!("FCT14A"==e.type||"FCT06A"==e.type||"FCT07A"==e.type)),body=JSON.stringify(l)}catch(n){console.log("zhihu vip_tab modules"+n)}break;case/questions\/\d+\/feeds/.test($request.url):try{let u=JSON.parse(body);delete u.ad_info,body=JSON.stringify(u)}catch(p){console.log("zhihu questions"+p)}break;case/next-data/.test($request.url):try{let h=JSON.parse(body),y=[];for(let b of h.data.data)"normal"==b.resource_type&&(b.data?.link_cards&&(b.data.link_cards=[]),y.push(b));h.data.data=y,body=JSON.stringify(h)}catch(f){console.log("zhihu next-data"+f)}break;case/bazaar\/vip_tab\/header/.test($request.url):try{let m=JSON.parse(body);m.vip_icon={day_url:"https://pic1.zhimg.com/v2-4812630bc27d642f7cafcd6cdeca3d7a_r.png",night_url:"https://pic1.zhimg.com/v2-c9686ff064ea3579730756ac6c289978_r.png"},m.vip_tip={jump_url:"https://t.me/ddgksf2021",text:"免费享5000w+优质内容",color_text:{text:"",color:""}},m.button=null,body=JSON.stringify(m)}catch($){console.log("zhihu vip_tab header"+$)}break;case/topstory\/hot-lists/.test($request.url):try{let g=JSON.parse(body);g.data.data=g.data.data.filter(e=>!e.promotion_extra),body=JSON.stringify(g)}catch(v){console.log("zhihu hot-lists"+v)}break;case/topstory\/recommend/.test($request.url):try{let z=JSON.parse(body),_=["TikTok","副业","赚钱","挣钱","自媒体","运营","电商","剪辑","公众号","失业","收益","稿费","天赚了","存款","兼职"],k=[];for(let x of z.data)if(!x.hasOwnProperty("ad")&&null==x.promotion_extra&&"feed_advert"!=x.type&&x.extra?.type!="pin"&&x.extra?.type!="Training"){if("common_card"==x.type&&x.extra?.type=="zvideo"){let w=x.common_card.feed_content.video.customized_page_url.match(/[?&]videoID=(\d+)/)[1];w&&(x.common_card.feed_content.video.id=w),k.push(x)}else if("common_card"==x.type&&x.common_card?.feed_content?.video?.id){let q='"feed_content":{"video":{"id":',j=$response.body.substring($response.body.indexOf(q)+q.length),T=j.substring(0,j.indexOf(","));x.common_card.feed_content.video.id=T,k.push(x)}else if(x.common_card?.feed_content?.title?.panel_text){var A=!1;_.forEach(e=>{x.common_card.feed_content.title.panel_text.includes(e)&&(A=!0)}),A||k.push(x)}else k.push(x)}z.data=k;for(let C=0;C<z.data.length;C++)z.data[C].offset=C+1;body=JSON.stringify(z)}catch(E){console.log("zhihu recommend"+E)}break;case/unlimited\/go\/my_card/.test($request.url):try{let F=JSON.parse(body);F.title="盐选会员",F.button_text="已开通",F.card_jump_url="",F.jump_url="",body=JSON.stringify(F)}catch(O){console.log("zhihu people"+O)}break;case/people\/self/.test($request.url):try{let D=JSON.parse(body);D.vip_info.is_vip=!0,D.vip_info.vip_icon={url:"https://pic1.zhimg.com/v2-4812630bc27d642f7cafcd6cdeca3d7a_r.png",night_mode_url:"https://pic1.zhimg.com/v2-c9686ff064ea3579730756ac6c289978_r.png"},D.vip_info.entrance={icon:{url:"https://pic1.zhimg.com/v2-5b7012c8c22fd520f5677305e1e551bf.png",night_mode_url:"https://pic1.zhimg.com/v2-e51e3252d7a2cb016a70879defd5da0b.png"},title:"我的盐选会员",expires_day:"2039-12-24",sub_title:null,button_text:"你好，知乎！",jump_url:"zhihu://vip/purchase",button_jump_url:"zhihu://vip/purchase",sub_title_new:null,identity:"svip"},D.vip_info.entrance_new={left_button:{title:"精选会员内容",description:"为您严选好内容",jump_url:"zhihu://market/home"},right_button:{title:"我的盐选会员",description:"畅享 10w+ 优质内容",jump_url:"zhihu://vip/my"}},D.vip_info.entrance_v2={title:"我的盐选会员",sub_title:"畅享 10w+ 优质内容",jump_url:"zhihu://vip/my",button_text:"查看权益"},body=JSON.stringify(D)}catch(I){console.log("zhihu people"+I)}break;case/commercial_api\/real_time_launch/.test($request.url):try{body=body.replace(/img_play_duration\\":\d+/g,'img_play_duration":0').replace(/launch_timeout\\":\d+/g,'launch_timeout":0')}catch(P){console.log("zhihu openad"+P)}break;case/search\/recommend_query/.test($request.url):try{let B=JSON.parse(body);B.recommend_queries?.queries&&(B.recommend_queries.queries=[{query:"",real_query:"",query_display:"",uuid:"f8c151ce-8bba-4491-89d1-06af4353e3da",type:"normal"}]),body=JSON.stringify(B)}catch(G){console.log("zhihu recommend_query"+G)}break;case/search\/tabs/.test($request.url):try{let H=JSON.parse(body);H.data=H.data.filter(e=>"pin"!=e.t),body=JSON.stringify(H)}catch(J){console.log("zhihu search\\/tabs"+J)}break;case/search\/preset_words/.test($request.url):try{let K=JSON.parse(body);K.preset_words?.words&&K.preset_words.words.forEach(e=>{e.begin_ts=3e9,e.end_ts=3000003600}),K.preset_words?.force_words&&K.preset_words.force_words.forEach(e=>{e.begin_ts=3e9,e.end_ts=3000003600}),body=JSON.stringify(K)}catch(L){console.log("zhihu preset_words"+L)}break;case/search\/hot_search/.test($request.url):try{let M=JSON.parse(body);M.hot_search_queries&&(M.hot_search_queries=[]),body=JSON.stringify(M)}catch(N){console.log("zhihu hot_search"+N)}break;case/bazaar\/vip_tab\/tabs/.test($request.url):try{let Q=JSON.parse(body);Q=Q.filter(e=>"vip_buy"!=e.value),body=JSON.stringify(Q)}catch(R){console.log("zhihu vip_tab"+R)}break;default:$done({})}$done({body})}else $done({});
