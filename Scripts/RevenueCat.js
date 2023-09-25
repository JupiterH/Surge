/***********************************
> ScriptName        RevenueCat多合一脚本[墨鱼版]
> Author            @ddgksf2013
> ScriptURL         https://gist.githubusercontent.com/ddgksf2013/dbb1695cd96743eef18f3fac5c6fe227/raw/revenuecat.js
# ========解锁列表======== #
# > 01 车票票
https://apps.apple.com/cn/app/id6446212291
# > 02 图图记账
https://apps.apple.com/cn/app/id1546356856
# > 03 Aphrodite
https://apps.apple.com/cn/app/id1568289454
# > 04 Apollo
https://apps.apple.com/cn/app/id1616467801
# > 05 pandora
https://apps.apple.com/cn/app/id1470560916
# > 06 widgetart
https://apps.apple.com/cn/app/id1539097448
# > 07 Spark
https://apps.apple.com/cn/app/id997102246
# > 08 Pillow
https://apps.apple.com/cn/app/id878691772
# > 09 1Blocker
https://apps.apple.com/cn/app/id1365531024

[rewrite_local]

# ～ RevenueCat@ddgksf2013
^https:\/\/api\.revenuecat\.com\/.+\/(receipts$|subscribers\/[^/]+$) url script-echo-response https://gist.githubusercontent.com/ddgksf2013/dbb1695cd96743eef18f3fac5c6fe227/raw/revenuecat.js
^https:\/\/api\.revenuecat\.com\/.+\/subscribers\/[^/]+/(offerings|attributes)$ url request-header (\r\n)X-RevenueCat-ETag:.+(\r\n) request-header $1X-RevenueCat-ETag:$2

[mitm]

hostname=api.revenuecat.com

***********************************/



//固定头部, tg频道：https://t.me/ddgksf2021
var ua = $request.headers['User-Agent'] || $request.headers['user-agent'];
var cuttlefish = {"Attention":"恭喜你抓到元数据！由墨鱼分享，请勿售卖或分享他人！","request_date_ms":1662599120248,"request_date":"2022-09-08T01:05:20Z","subscriber":{"non_subscriptions":{},"first_seen":"2022-09-08T01:04:03Z","original_application_version":"8","other_purchases":{},"management_url":"https://apps.apple.com/account/subscriptions","subscriptions":{},"entitlements":{},"original_purchase_date":"2022-09-07T13:05:43Z","original_app_user_id":"$RCAnonymousID:ddgksf2013","last_seen":"2022-09-08T01:04:03Z"}};
var ddgksf2013={"is_sandbox":false,"ownership_type":"PURCHASED","billing_issues_detected_at":null,"period_type":"normal","expires_date":"2099-12-18T01:04:17Z","grace_period_expires_date":null,"unsubscribe_detected_at":null,"original_purchase_date":"2022-09-08T01:04:18Z","purchase_date":"2022-09-08T01:04:17Z","store":"app_store"};
var ddgksf2021={"grace_period_expires_date":null,"purchase_date":"2022-09-08T01:04:17Z","product_identifier":"ddgksf2013_1y_128","expires_date":"2099-12-18T01:04:17Z"};
var obj = JSON.parse(JSON.stringify(cuttlefish));
ddgksf2021['product_identifier']="com.ddgksf2013.premium.yearly";
obj['subscriber']['subscriptions']['com.ddgksf2013.premium.yearly']=ddgksf2013;

//动态ID分配
if(ua.indexOf('%E8%BD%A6%E7%A5%A8%E7%A5%A8') != -1) {//车票票
 obj['subscriber']['entitlements']['vip+watch_vip']=ddgksf2021;
}
else if(ua.indexOf('totowallet') != -1) {//图图记账
	obj['subscriber']['entitlements']['all']=ddgksf2021;
}
else if(ua.indexOf('Aphrodite') != -1) {//Aphrodite
	obj['subscriber']['entitlements']['all']=ddgksf2021;
}
else if(ua.indexOf('apollo') != -1) {//apollo
	obj['subscriber']['entitlements']['all']=ddgksf2021;
}
else if(ua.indexOf('widget_art') != -1) {//widget_art
	obj['subscriber']['entitlements']['all']=ddgksf2021;	
}
else if(ua.indexOf('OneBox') != -1) {//pandora
  obj['subscriber']['entitlements']['all']=ddgksf2021;
}
else if(ua.indexOf('Spark') != -1) {//spark
	obj['subscriber']['entitlements']['premium']=ddgksf2021;	
}
else if(ua.indexOf('Pillow') != -1) {//pillow
	obj['subscriber']['entitlements']['premium']=ddgksf2021;
}
else if(ua.indexOf('1Blocker') != -1) {//1Blocker
	obj['subscriber']['entitlements']['premium']=ddgksf2021;
}
else{
  obj['subscriber']['entitlements']['pro']=ddgksf2021;
}
$done({body: JSON.stringify(obj)});
