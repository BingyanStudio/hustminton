const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};


// 参加活动
const joinActivity = async (event) => {
  const { activityId, userInfo } = event
  const wxContext = cloud.getWXContext()
  // 1. 更新活动participants
  await db.collection('activities').doc(activityId).update({
    data: {
      participants: db.command.push([{
        openid: wxContext.OPENID,
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl,
        level: userInfo.level
      }]),
      current_num: db.command.inc(1)
    }
  })
  // 2. 更新用户joined_activities
  await db.collection('users').doc(wxContext.OPENID).update({
    data: {
      joined_activities: db.command.addToSet(activityId)
    }
  })
  return { success: true }
}
// 退出活动
const quitActivity = async (event) => {
  const { activityId } = event
  const wxContext = cloud.getWXContext()
  await db.collection('activities').doc(activityId).update({
    data: {
      participants: db.command.pull({ openid: wxContext.OPENID }),
      current_num: db.command.inc(-1)
    }
  })
  await db.collection('users').doc(wxContext.OPENID).update({
    data: {
      joined_activities: db.command.pull(activityId)
    }
  })
  return { success: true }
}
// 发布活动
const publishActivity = async (event) => {
  const { activity } = event
  const wxContext = cloud.getWXContext()
  const res = await db.collection('activities').add({
    data: {
      ...activity,
      creator_openid: wxContext.OPENID,
      creator_info: activity.creator_info,
      participants: [],
      current_num: 0,
      status: '未开始'
    }
  })
  await db.collection('users').doc(wxContext.OPENID).update({
    data: {
      created_activities: db.command.addToSet(res._id)
    }
  })
  return { success: true, id: res._id }
}
// 修改个人信息
const updateUserInfo = async (event) => {
  const { userInfo } = event
  if (!userInfo) {
    throw new Error('User information is missing')
  }
  const wxContext = cloud.getWXContext()
  await db.collection('users').doc(wxContext.OPENID).set({
    data: {
      ...userInfo
    }
  })
  return { success: true }
}


// 获取用户信息
const getUserInfo = async (event) => {
  const wxContext = cloud.getWXContext()

  try {
    const result = await db.collection('users').doc(wxContext.OPENID).get()
    if (result.data) {
      return {
        success: true,
        userInfo: result.data
      }
    } else {
      return {
        success: false,
        message: '用户信息不存在'
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      message: '获取用户信息失败',
      error: error.message
    }
  }
}

// 用户登录/初始化（兼容旧版本调用）
const login = async (event) => {
  const { userInfo } = event
  if (!userInfo) {
    throw new Error('User information is missing')
  }

  // 直接调用updateUserInfo来创建或更新用户记录
  return await updateUserInfo(event)
}

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const sumRecord = require('./sumRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "joinActivity":
      return await joinActivity(event);
    case "quitActivity":
      return await quitActivity(event);
    case "publishActivity":
      return await publishActivity(event);
    case "updateUserInfo":
      return await updateUserInfo(event);
    case "login":
      return await login(event);
    case "getUserInfo":
      return await getUserInfo(event);
  }
};
