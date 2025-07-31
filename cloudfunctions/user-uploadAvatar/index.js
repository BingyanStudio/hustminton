// 云函数：更新用户头像
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { fileID } = event

  try {
    console.log('更新用户头像，用户ID:', OPENID, '文件ID:', fileID)

    // 更新用户头像
    const updateResult = await db.collection('users').doc(OPENID).update({
      data: {
        avatarUrl: fileID,
        updatedAt: new Date()
      }
    })

    console.log('头像更新结果:', updateResult)

    // 如果用户记录不存在，创建新记录
    if (updateResult.stats.updated === 0) {
      console.log('用户记录不存在，创建新记录')
      await db.collection('users').doc(OPENID).set({
        data: {
          avatarUrl: fileID,
          nickName: '用户',
          createTime: new Date(),
          updatedAt: new Date()
        }
      })
      console.log('创建用户记录成功')
    }

    return {
      success: true,
      message: '头像更新成功',
      data: {
        avatarUrl: fileID
      }
    }
  } catch (error) {
    console.error('更新头像失败:', error)
    return {
      success: false,
      message: '头像更新失败',
      error: error.message
    }
  }
}
