// 云函数：删除约球活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId } = event

  try {
    // 验证活动所有权
    const match = await db.collection('matches').doc(matchId).get()
    if (!match.data || match.data.publisher !== OPENID) {
      return { success: false, message: '无权删除此活动' }
    }

    // 删除活动
    await db.collection('matches').doc(matchId).remove()

    return {
      success: true,
      message: '活动删除成功'
    }
  } catch (e) {
    console.error('活动删除失败', e)
    return {
      success: false,
      message: '活动删除失败',
      error: e.message
    }
  }
}