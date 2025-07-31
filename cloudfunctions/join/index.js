// 云函数：加入约球活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId } = event

  try {
    // 查询活动信息
    const match = await db.collection('matches').doc(matchId).get()
    if (!match.data) {
      return { success: false, message: '活动不存在' }
    }

    // 检查是否为发布者
    if (match.data.publisher === OPENID) {
      return { success: false, message: '发布者不能加入自己的活动' }
    }

    // 检查是否已加入
    const isJoined = match.data.participants.some(p => p._id === OPENID)
    if (isJoined) {
      return { success: false, message: '已加入该活动' }
    }

    // 检查人数是否已满
    const playerCount = parseInt(match.data.playerCount) || 0
    const currentParticipants = match.data.participants.length

    console.log('满员检查:', {
      当前人数: currentParticipants,
      场地人数: playerCount,
      是否满员: currentParticipants >= playerCount
    })

    if (currentParticipants >= playerCount) {
      return {
        success: false,
        message: `活动人数已满（${currentParticipants}/${playerCount}人）`,
        code: 'ACTIVITY_FULL'
      }
    }

    // 查询用户信息获取头像和昵称
    let userInfo = null
    let avatarUrl = 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg'
    let nickName = '用户'

    try {
      const userResult = await db.collection('users').doc(OPENID).get()
      if (userResult.data) {
        userInfo = userResult.data
        // 尝试多种可能的头像字段名
        avatarUrl = userInfo.avatarUrl || userInfo.avatar || userInfo.avatar_url || userInfo.headimgurl || avatarUrl
        nickName = userInfo.nickName || userInfo.nickname || userInfo.name || nickName
        console.log('查询到用户信息:', { avatarUrl, nickName })
      }
    } catch (userError) {
      console.log('查询用户信息失败，使用默认信息:', userError)
      // 如果用户信息不存在，创建基础用户记录
      try {
        await db.collection('users').doc(OPENID).set({
          data: {
            nickName: '用户',
            avatarUrl: avatarUrl,
            createTime: db.serverDate()
          }
        })
        console.log('创建了基础用户记录')
      } catch (createError) {
        console.log('创建用户记录失败:', createError)
      }
    }

    // 构建参与者信息对象
    const participantInfo = {
      _id: OPENID,
      joinTime: new Date(),
      avatarUrl: avatarUrl,
      nickName: nickName
    }

    // 添加参与者
    await db.collection('matches').doc(matchId).update({
      data: {
        participants: _.push(participantInfo),
        people: _.push(participantInfo),
        updatedAt: new Date()
      }
    })

    // 创建通知给活动发布者
    try {
      await db.collection('notifications').add({
        data: {
          type: 'join', // 加入通知
          matchId: matchId,
          matchTitle: match.data.title,
          publisherId: match.data.publisher, // 活动发布者
          participantId: OPENID, // 参与者
          participantName: nickName,
          participantAvatar: avatarUrl,
          message: `${nickName} 加入了您的活动`,
          isRead: false,
          createTime: db.serverDate()
        }
      })
      console.log('创建加入通知成功')
    } catch (notificationError) {
      console.error('创建通知失败:', notificationError)
      // 不影响主流程，继续执行
    }

    console.log('用户加入活动成功，参与者信息:', participantInfo)
    return { success: true, message: '加入活动成功' }
  } catch (e) {
    console.error('加入活动失败', e)
    return { success: false, message: '加入活动失败', error: e.message }
  }
}