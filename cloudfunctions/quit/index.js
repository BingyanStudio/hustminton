// 云函数：退出约球活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId } = event

  console.log('=== 退出活动请求 ===')
  console.log('用户ID:', OPENID)
  console.log('活动ID:', matchId)

  try {
    // 1. 获取活动数据
    const matchDoc = await db.collection('matches').doc(matchId).get()
    if (!matchDoc.data) {
      console.log('❌ 活动不存在')
      return { success: false, message: '活动不存在' }
    }

    const matchData = matchDoc.data
    console.log('📋 活动信息:')
    console.log('- 参与者数量:', matchData.participants.length)
    console.log('- 参与者列表:', matchData.participants.map(p => `${p._id}(${p.isPublisher ? '发布者' : '参与者'})`))

    // 2. 检查用户是否在列表中
    const userIndex = matchData.participants.findIndex(p => p._id === OPENID)
    if (userIndex === -1) {
      console.log('❌ 用户不在参与者列表中')
      return { success: false, message: '您未参与此活动' }
    }

    const userInfo = matchData.participants[userIndex]
    console.log('👤 用户信息:', userInfo)

    // 3. 检查是否为发布者
    if (userInfo.isPublisher) {
      console.log('❌ 发布者不能退出')
      return { success: false, message: '发布者不能退出自己的活动' }
    }

    // 4. 创建新的参与者列表（移除当前用户）
    const newParticipants = matchData.participants.filter(p => p._id !== OPENID)
    const newPeople = matchData.people ? matchData.people.filter(p => p._id !== OPENID) : newParticipants

    console.log('🔄 更新后的列表:')
    console.log('- 新参与者数量:', newParticipants.length)
    console.log('- 新people数量:', newPeople.length)

    // 5. 更新数据库 - 使用完整替换
    const updateData = {
      ...matchData,
      participants: newParticipants,
      people: newPeople,
      updatedAt: new Date()
    }

    // 删除_id字段，避免冲突
    delete updateData._id

    const updateResult = await db.collection('matches').doc(matchId).set({
      data: updateData
    })

    console.log('💾 数据库更新结果:', updateResult)

    // 创建通知给活动发布者
    try {
      // 获取用户信息用于通知
      let nickName = '用户'
      let avatarUrl = 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg'

      try {
        const userResult = await db.collection('users').doc(OPENID).get()
        if (userResult.data) {
          nickName = userResult.data.nickName || userResult.data.nickname || nickName
          avatarUrl = userResult.data.avatarUrl || userResult.data.avatar || avatarUrl
        }
      } catch (userError) {
        console.log('获取用户信息失败，使用默认值')
      }

      await db.collection('notifications').add({
        data: {
          type: 'quit', // 退出通知
          matchId: matchId,
          matchTitle: matchData.title,
          publisherId: matchData.publisher, // 活动发布者
          participantId: OPENID, // 参与者
          participantName: nickName,
          participantAvatar: avatarUrl,
          message: `${nickName} 退出了您的活动`,
          isRead: false,
          createTime: db.serverDate()
        }
      })
      console.log('创建退出通知成功')
    } catch (notificationError) {
      console.error('创建通知失败:', notificationError)
      // 不影响主流程，继续执行
    }

    // 6. 验证更新结果
    const verifyDoc = await db.collection('matches').doc(matchId).get()
    const stillExists = verifyDoc.data.participants.find(p => p._id === OPENID)

    if (stillExists) {
      console.log('❌ 验证失败：用户仍在列表中')
      return { success: false, message: '退出失败，请重试' }
    }

    console.log('✅ 退出成功！用户已从参与者列表中移除')
    return { success: true, message: '退出活动成功' }

  } catch (error) {
    console.error('💥 退出活动时发生错误:', error)
    return {
      success: false,
      message: '退出活动失败',
      error: error.message
    }
  }
}