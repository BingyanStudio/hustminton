// 云函数：数据清理
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { type = 'all' } = event
  const results = {}

  try {
    // 计算时间阈值
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    console.log('开始数据清理，类型:', type)
    console.log('时间阈值:', {
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      threeDaysAgo: threeDaysAgo.toISOString(),
      sixMonthsAgo: sixMonthsAgo.toISOString()
    })

    // 自动清理模式：更保守的清理策略
    const isAutoMode = type === 'auto'
    if (isAutoMode) {
      console.log('使用自动清理模式，采用保守策略')
    }

    // 清理已结束的活动
    if (type === 'all' || type === 'matches' || type === 'auto') {
      console.log('开始清理已结束的活动...')

      // 根据模式选择不同的清理策略
      let queryConditions
      if (isAutoMode) {
        // 自动模式：只清理明确过期的数据
        queryConditions = _.or([
          // 60天前的已结束活动（更保守）
          {
            date: _.lt(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
            status: _.in(['finished', 'cancelled'])
          },
          // 或者创建时间超过90天的活动
          {
            createdAt: _.lt(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
          }
        ])
      } else {
        // 手动模式：使用原有策略
        queryConditions = _.or([
          // 30天前的已结束活动
          {
            date: _.lt(thirtyDaysAgo.toISOString().split('T')[0]),
            status: _.in(['finished', 'cancelled'])
          },
          // 或者创建时间超过60天的活动
          {
            createdAt: _.lt(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000))
          }
        ])
      }

      // 查找需要清理的活动
      const expiredMatches = await db.collection('matches')
        .where(queryConditions)
        .get()

      console.log('找到需要清理的活动数量:', expiredMatches.data.length)

      // 删除过期活动
      let deletedMatches = 0
      for (const match of expiredMatches.data) {
        try {
          await db.collection('matches').doc(match._id).remove()
          deletedMatches++
          console.log('删除活动:', match._id)
        } catch (error) {
          console.error('删除活动失败:', match._id, error)
        }
      }

      results.matches = {
        found: expiredMatches.data.length,
        deleted: deletedMatches
      }
    }

    // 清理通知记录
    if (type === 'all' || type === 'notifications' || type === 'auto') {
      console.log('开始清理通知记录...')

      let oldReadNotifications, veryOldNotifications

      if (isAutoMode) {
        // 自动模式：更保守的清理策略
        // 清理已读且超过14天的通知
        oldReadNotifications = await db.collection('notifications')
          .where({
            isRead: true,
            readTime: _.lt(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
          })
          .get()

        // 清理超过60天的所有通知
        veryOldNotifications = await db.collection('notifications')
          .where({
            createTime: _.lt(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000))
          })
          .get()
      } else {
        // 手动模式：使用原有策略
        // 清理已读且超过7天的通知
        oldReadNotifications = await db.collection('notifications')
          .where({
            isRead: true,
            readTime: _.lt(sevenDaysAgo)
          })
          .get()

        // 清理超过30天的所有通知
        veryOldNotifications = await db.collection('notifications')
          .where({
            createTime: _.lt(thirtyDaysAgo)
          })
          .get()
      }

      const allNotificationsToDelete = [
        ...oldReadNotifications.data,
        ...veryOldNotifications.data
      ]

      // 去重
      const uniqueNotifications = allNotificationsToDelete.filter((notification, index, self) =>
        index === self.findIndex(n => n._id === notification._id)
      )

      console.log('找到需要清理的通知数量:', uniqueNotifications.length)

      let deletedNotifications = 0
      for (const notification of uniqueNotifications) {
        try {
          await db.collection('notifications').doc(notification._id).remove()
          deletedNotifications++
        } catch (error) {
          console.error('删除通知失败:', notification._id, error)
        }
      }

      results.notifications = {
        found: uniqueNotifications.length,
        deleted: deletedNotifications
      }
    }

    // 清理孤立的通知（关联的活动已不存在）
    if (type === 'all' || type === 'orphanNotifications') {
      console.log('开始清理孤立通知...')
      
      const allNotifications = await db.collection('notifications').get()
      const allMatches = await db.collection('matches').get()
      const matchIds = new Set(allMatches.data.map(m => m._id))

      const orphanNotifications = allNotifications.data.filter(
        notification => notification.matchId && !matchIds.has(notification.matchId)
      )

      console.log('找到孤立通知数量:', orphanNotifications.length)

      let deletedOrphanNotifications = 0
      for (const notification of orphanNotifications) {
        try {
          await db.collection('notifications').doc(notification._id).remove()
          deletedOrphanNotifications++
        } catch (error) {
          console.error('删除孤立通知失败:', notification._id, error)
        }
      }

      results.orphanNotifications = {
        found: orphanNotifications.length,
        deleted: deletedOrphanNotifications
      }
    }

    // 清理长期未登录用户（可选，谨慎使用）
    if (type === 'inactiveUsers') {
      console.log('开始清理长期未登录用户...')
      
      const inactiveUsers = await db.collection('users')
        .where({
          lastLoginTime: _.lt(sixMonthsAgo)
        })
        .get()

      console.log('找到长期未登录用户数量:', inactiveUsers.data.length)

      let deletedUsers = 0
      for (const user of inactiveUsers.data) {
        try {
          await db.collection('users').doc(user._id).remove()
          deletedUsers++
        } catch (error) {
          console.error('删除用户失败:', user._id, error)
        }
      }

      results.inactiveUsers = {
        found: inactiveUsers.data.length,
        deleted: deletedUsers
      }
    }

    console.log('数据清理完成，结果:', results)

    return {
      success: true,
      message: '数据清理完成',
      results,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('数据清理失败:', error)
    return {
      success: false,
      message: '数据清理失败',
      error: error.message,
      results
    }
  }
}
