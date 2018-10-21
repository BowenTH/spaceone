const uuid = require('uuid/v4');
const AV = require('leanengine');
const Order = require('./order');
const wxpay = require('./wxpay');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(request, response) {
  response.success('Hello world!');
});

/** 
 * 小程序创建订单
 */
AV.Cloud.define('order', (request, response) => {
  const user = request.currentUser;
  if (!user) {
    return response.error(new Error('用户未登录'));
  }
  const authData = user.get('authData');
  if (!authData || !authData.lc_weapp) {
    return response.error(new Error('当前用户不是小程序用户'));
  }
  const order = new Order();
  order.tradeId = uuid().replace(/-/g, '');
  order.user = request.currentUser;
  order.productDescription = process.env.SHOP_BRAND;
  // 修改金额
  let {status, dealStatue, timePick, amount, balance, foodList, userSpeak, address, productDescription,
    tradeType, shopId, shopOwner} = request.params
  
  order.amount = request.amount||100;
  order.ip = request.meta.remoteAddress;
  if (!(order.ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(order.ip))) {
    order.ip = '127.0.0.1';
  }
  order.tradeType = 'JSAPI';
  order.set('status', status)
  order.set('dealStatue',dealStatue)
  order.set('timePick',timePick)
  order.set('amount',amount)
  order.set('balance',balance)
  order.set('foodList',foodList)
  order.set('userSpeak',userSpeak)
  order.set('address',address)
  order.set('productDescription',productDescription)
  order.set('shop',AV.Object.createWithoutData('Shop', shopId))
  order.set('user',user)

  const acl = new AV.ACL();
  // 只有创建订单的用户可以读，没有人可以写
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  acl.setReadAccess(user, true);
  acl.setWriteAccess(user, false);

  acl.setReadAccess(user, true);
  acl.setWriteAccess(user, false);
  order.setACL(acl);
  order.place().then(() => {
    console.log(`预订单创建成功：订单号 [${order.tradeId}] prepayId [${order.prepayId}]`);
    const payload = {
      appId: process.env.WEIXIN_APPID,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      package: `prepay_id=${order.prepayId}`,
      signType: 'MD5',
      nonceStr: String(Math.random()),
    }
    payload.paySign = wxpay.sign(payload);
    response.success(payload);
  }).catch(error => {
    console.error(error);
    response.error(error);
  });
});

// 继续支付未支付的订单
AV.Cloud.define('payOrder', (request, response)=> {
  const user = request.currentUser;
  if (!user) {
    return response.error(new Error('用户未登录'));
  }
  const authData = user.get('authData');
  if (!authData || !authData.lc_weapp) {
    return response.error(new Error('当前用户不是小程序用户'));
  }
  let orderId = request.params.orderId;
  new AV.Query('Order').get(orderId).then(order=>{
    if (order) {
      const payload = {
        appId: process.env.WEIXIN_APPID,
        timeStamp: String(Math.floor(Date.now() / 1000)),
        package: `prepay_id=${order.prepayId}`,
        signType: 'MD5',
        nonceStr: String(Math.random()),
      }
      payload.paySign = wxpay.sign(payload);
      response.success(payload);
    } else {
      response.error('未查到订单')
    }
  }).catch(err => {
    console.log(err)
    response.error(err)
  })
  
})

// 删除未支付的订单
AV.Cloud.define('deleteOrder', (request, response)=> {
  const user = request.currentUser;
  if (!user) {
    return response.error(new Error('用户未登录'));
  }
  const authData = user.get('authData');
  if (!authData || !authData.lc_weapp) {
    return response.error(new Error('当前用户不是小程序用户'));
  }

  let {orderId} = request.params
  var order = AV.Object.createWithoutData('Order', orderId);
   order.destroy().then(res=> {
    if (res) {
      response.success('订单删除成功')
    }
  }).catch(err => {
    console.log(err)
    response.error(err)
  })
  
})