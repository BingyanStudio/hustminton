// 云函数：更新约球活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId, title, date, timeSlot, dateText, location, project, level, playerCount, recruitCount, description, contact } = event

  try {
    // 验证活动所有权
    const match = await db.collection('matches').doc(matchId).get()
    if (!match.data || match.data.publisher !== OPENID) {
      return { success: false, message: '无权编辑此活动' }
    }

    // 更新活动信息
    await db.collection('matches').doc(matchId).update({
      data: {
        title,
        date,
        timeSlot,
        dateText,
        location,
        project,
        level,
        playerCount,
        recruitCount: parseInt(recruitCount) || 0,
        description,
        contact,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      message: '活动更新成功'
    }
  } catch (e) {
    console.error('活动更新失败', e)
    return {
      success: false,
      message: '活动更新失败',
      error: e.message
    }
  }
}