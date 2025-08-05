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

  // 准备保存的用户信息字段
const filteredUserInfo = {}

// 保留必要的用户信息字段
if (userInfo.nickname) {
  filteredUserInfo.nickname = userInfo.nickname
}
if (userInfo.gender) {
  filteredUserInfo.gender = userInfo.gender
}
if (userInfo.birthdate) {
  filteredUserInfo.birthdate = userInfo.birthdate
}
if (userInfo.level) {
  filteredUserInfo.level = userInfo.level
}
// 确保contactType和contactValue总是被保存，即使为空字符串
filteredUserInfo.contactType = userInfo.contactType || '';
filteredUserInfo.contactValue = userInfo.contactValue || '';

// 兼容旧版phoneNumber字段
if (userInfo.phoneNumber) {
  filteredUserInfo.phoneNumber = userInfo.phoneNumber
}

  // 保留自定义头像（如果不是微信头像）
  if (userInfo.avatarUrl && !userInfo.avatarUrl.includes('thirdwx.qlogo.cn') && !userInfo.avatarUrl.includes('wx.qlogo.cn')) {
    filteredUserInfo.avatarUrl = userInfo.avatarUrl
  }

  console.log('保存用户信息:', filteredUserInfo)

  // 使用merge: true只更新提供的字段，不覆盖原有数据
  await db.collection('users').doc(wxContext.OPENID).set({
    data: {
      ...filteredUserInfo,
      updatedAt: new Date(),
      // 确保用户记录存在，如果是新用户则创建
      createdAt: db.serverDate()
    },
    merge: true
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

  const wxContext = cloud.getWXContext()
  console.log('用户登录，OPENID:', wxContext.OPENID)
  console.log('用户信息:', userInfo)

  // 处理手机号信息
  let phoneNumber = null
  if (userInfo.phoneInfo) {
    try {
      // 如果有cloudID，使用云函数解密获取手机号
      if (userInfo.phoneInfo.cloudID) {
        console.log('使用cloudID获取手机号:', userInfo.phoneInfo.cloudID)
        // 调用云开发API解密手机号
        const phoneResult = await cloud.getOpenData({
          list: [userInfo.phoneInfo.cloudID],
        })
        // 提取解密后的手机号
        if (phoneResult.list && phoneResult.list.length > 0 && phoneResult.list[0].data) {
          phoneNumber = phoneResult.list[0].data.phoneNumber
          console.log('成功获取手机号:', phoneNumber)
        } else {
          console.error('解密手机号失败: 未获取到有效数据')
        }
      } else if (userInfo.phoneInfo.encryptedData && userInfo.phoneInfo.iv) {
        console.log('收到加密的手机号数据，需要解密')
        // 这里需要解密手机号，暂时先记录
        phoneNumber = 'encrypted_phone_data'
      }
    } catch (error) {
      console.error('处理手机号信息失败:', error)
    }
  }

  // 准备保存的用户信息 - 只保留必要字段
  const saveUserInfo = {}

  // 保留非微信头像（如果有）
  if (userInfo.avatarUrl && !userInfo.avatarUrl.includes('thirdwx.qlogo.cn') && !userInfo.avatarUrl.includes('wx.qlogo.cn')) {
    saveUserInfo.avatarUrl = userInfo.avatarUrl
  }

  // 如果有手机号，添加到用户信息中
  if (phoneNumber) {
    saveUserInfo.phoneNumber = phoneNumber
  }

  // 调用updateUserInfo来创建或更新用户记录
  const result = await updateUserInfo({ userInfo: saveUserInfo })

  console.log('用户登录完成')
  return result
}

// 保存用户反馈
const saveFeedback = async (event) => {
  const wxContext = cloud.getWXContext()
  const { feedbackType, contact, content, userInfo, timestamp } = event
  const type = feedbackType || '用户反馈'

  try {
    console.log('收到用户反馈:', {
      type,
      contact,
      content,
      userInfo,
      userId: wxContext.OPENID,
      timestamp
    })

    const db = cloud.database()

    // 准备反馈数据
    const feedbackData = {
      type: type || '用户反馈',
      contact: contact || '',
      content: content,
      userInfo: {
        nickName: userInfo?.nickName || '匿名用户',
        avatarUrl: userInfo?.avatarUrl || ''
      },
      userId: wxContext.OPENID,
      timestamp: timestamp || new Date().toISOString(),
      status: 'pending',
      createTime: new Date(),
      _openid: wxContext.OPENID
    }

    // 保存到数据库（如果集合不存在会自动创建）
    const result = await db.collection('feedback').add({
      data: feedbackData
    })

    console.log('反馈保存成功:', result)

    // 在控制台输出格式化的反馈信息
    console.log('📧 新的用户反馈')
    console.log('====================================================')
    console.log(`反馈类型: ${feedbackData.type}`)
    console.log(`用户昵称: ${feedbackData.userInfo.nickName}`)
    console.log(`用户ID: ${feedbackData.userId}`)
    console.log(`联系方式: ${feedbackData.contact || '未提供'}`)
    console.log(`反馈时间: ${new Date(feedbackData.timestamp).toLocaleString('zh-CN')}`)
    console.log(`反馈内容: ${feedbackData.content}`)
    console.log('====================================================')

    // 立即返回成功响应（不等待邮件发送）
    const response = {
      success: true,
      message: '反馈提交成功，我们会尽快处理您的反馈',
      data: {
        id: result._id,
        timestamp: feedbackData.createTime
      }
    }

    // 暂时禁用邮件发送，确保反馈功能稳定
    console.log('📧 邮件发送功能暂时禁用')
    console.log('💡 反馈信息已完整记录，可通过以下方式查看：')
    console.log('   1. 云函数日志（当前方式）')
    console.log('   2. 云数据库 feedback 集合')
    console.log('📋 完整反馈信息已记录到日志和数据库中')

    return response

  } catch (error) {
    console.error('保存反馈失败:', error)
    return {
      success: false,
      message: '反馈提交失败: ' + error.message,
      error: error.message
    }
  }
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
    case "saveFeedback":
      return await saveFeedback(event);
    default:
      return {
        success: false,
        message: `Unknown event type: ${event.type}`
      };
  }
};
