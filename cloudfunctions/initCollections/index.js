// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: 'cloud1-7guleuaib5fb4758'
})
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 创建activities集合
    await db.createCollection('activities')
    console.log('创建activities集合成功')
  } catch (e) {
    console.log('activities集合已存在')
  }

  try {
    // 创建users集合
    await db.createCollection('users')
    console.log('创建users集合成功')
  } catch (e) {
    console.log('users集合已存在')
  }

  try {
    // 创建notifications集合
    await db.createCollection('notifications')
    console.log('创建notifications集合成功')
  } catch (e) {
    console.log('notifications集合已存在')
  }

  return {
    success: true,
    message: '数据库初始化完成'
  }
} 