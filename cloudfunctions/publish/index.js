// 云函数：发布约球活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { matchData } = event
const {date, timeSlot, dateText, location, project, level, playerCount, recruitCount, description, contact } = matchData
// 确保playerCount是数字类型
const numPlayerCount = parseInt(playerCount)

  try {
    // 查询发布者用户信息获取头像和昵称
    let avatarUrl = 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg'
    let nickName = '发布者'

    try {
      const userResult = await db.collection('users').doc(OPENID).get()
      if (userResult.data) {
        const userInfo = userResult.data
        // 尝试多种可能的头像字段名
        avatarUrl = userInfo.avatarUrl || userInfo.avatar || userInfo.avatar_url || userInfo.headimgurl || avatarUrl
        nickName = userInfo.nickName || userInfo.nickname || userInfo.name || nickName
        console.log('查询到发布者信息:', { avatarUrl, nickName })
      }
    } catch (userError) {
      console.log('查询发布者信息失败，使用默认信息:', userError)
      // 如果用户信息不存在，创建基础用户记录
      try {
        await db.collection('users').doc(OPENID).set({
          data: {
            nickName: '发布者',
            avatarUrl: avatarUrl,
            createTime: db.serverDate()
          }
        })
        console.log('创建了发布者基础用户记录')
      } catch (createError) {
        console.log('创建发布者用户记录失败:', createError)
      }
    }

    // 构建发布者信息对象
    const publisherInfo = {
      _id: OPENID,
      isPublisher: true,
      joinTime: new Date(),
      avatarUrl: avatarUrl,
      nickName: nickName
    }

    // 创建约球活动记录
    const result = await db.collection('matches').add({
      data: {
        date,
      timeSlot,
      dateText,
      location,
      project,
      level,
      playerCount: numPlayerCount,
      description,
      contact,
      publisher: OPENID,
      participants: [publisherInfo],
      people: [publisherInfo],
      recruitCount: parseInt(recruitCount) || 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
      }
    })

    console.log('约球活动发布成功，发布者信息:', publisherInfo)
    return {
      success: true,
      message: '约球活动发布成功',
      data: { matchId: result._id }
    }
  } catch (e) {
    console.error('约球活动发布失败', e)
    return {
      success: false,
      message: '约球活动发布失败',
      error: e.message
    }
  }
}