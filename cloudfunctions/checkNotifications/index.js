const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 获取用户发布的所有活动（注意字段名是publisher，不是publisherId）
    const myPublishedResult = await db.collection('matches').where({
      publisher: openid
    }).get()

    console.log('查询到的我发布的活动数量:', myPublishedResult.data.length)

    let totalNewNotifications = 0

    // 检查每个活动的参与者变化
    for (const match of myPublishedResult.data) {
      // 获取该活动的通知记录
      const notificationResult = await db.collection('notifications').where({
        matchId: match._id,
        publisherId: openid,
        isRead: false
      }).get()

      console.log(`活动 ${match._id} 的未读通知数量:`, notificationResult.data.length)
      totalNewNotifications += notificationResult.data.length
    }

    console.log('总未读通知数量:', totalNewNotifications)

    return {
      success: true,
      data: {
        myPublishedCount: totalNewNotifications
      }
    }
  } catch (error) {
    console.error('检查通知失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
