// 云函数：退出约球活动 - 备用版本使用pull操作
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId } = event

  try {
    console.log('开始处理退出请求 (pull方法):', { matchId, userId: OPENID })
    
    // 查询活动信息
    const match = await db.collection('matches').doc(matchId).get()
    if (!match.data) {
      console.log('活动不存在:', matchId)
      return { success: false, message: '活动不存在' }
    }

    console.log('查询到的活动信息:', {
      matchId: match.data._id,
      participantsCount: match.data.participants.length
    })

    // 检查用户是否在参与者列表中
    const userParticipant = match.data.participants.find(p => p._id === OPENID)
    if (!userParticipant) {
      console.log('用户未参与此活动:', OPENID)
      return { success: false, message: '您未参与此活动' }
    }

    // 检查用户是否为发布者
    if (userParticipant.isPublisher) {
      console.log('发布者不能退出自己的活动:', OPENID)
      return { success: false, message: '发布者不能退出自己的活动' }
    }

    // 使用pull操作移除用户
    const updateResult = await db.collection('matches').doc(matchId).update({
      data: {
        participants: _.pull(_.and([{ _id: OPENID }])),
        people: _.pull(_.and([{ _id: OPENID }])),
        updatedAt: new Date()
      }
    })

    console.log('pull操作更新结果:', updateResult)

    // 验证更新是否成功
    const verifyResult = await db.collection('matches').doc(matchId).get()
    const stillInList = verifyResult.data.participants.find(p => p._id === OPENID)
    
    if (stillInList) {
      console.error('pull操作失败，用户仍在参与者列表中')
      return {
        success: false,
        message: '退出失败，请重试'
      }
    }

    console.log('pull操作成功，用户已从参与者列表中移除')
    
    return {
      success: true,
      message: '退出活动成功'
    }
  } catch (e) {
    console.error('退出活动失败', e)
    return {
      success: false,
      message: '退出活动失败',
      error: e.message
    }
  }
}
