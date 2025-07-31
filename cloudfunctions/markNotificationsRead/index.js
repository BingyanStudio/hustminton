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
    // 将用户发布的活动的所有未读通知标记为已读
    const updateResult = await db.collection('notifications').where({
      publisherId: openid,
      isRead: false
    }).update({
      data: {
        isRead: true,
        readTime: db.serverDate()
      }
    })

    console.log('标记通知为已读:', updateResult)

    return {
      success: true,
      data: {
        updatedCount: updateResult.stats.updated
      }
    }
  } catch (error) {
    console.error('标记通知为已读失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
