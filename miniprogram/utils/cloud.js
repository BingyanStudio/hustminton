// 云开发工具类
class CloudService {
  constructor() {
    this.isInitialized = false
  }

  // 初始化云开发
  init() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return false
    }
    
    try {
      wx.cloud.init({
        env: "cloud1-7guleuaib5fb4758",
        traceUser: true,
      })
      this.isInitialized = true
      console.log('云开发环境初始化成功')
      return true
    } catch (error) {
      console.error('云开发环境初始化失败:', error)
      return false
    }
  }

  // 调用云函数
  callFunction(name, data = {}) {
    if (!this.isInitialized) {
      console.error('云开发环境未初始化')
      return Promise.reject(new Error('云开发环境未初始化'))
    }

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: name,
        data: data,
        success: (res) => {
          if (res.result && res.result.success !== undefined) {
            if (res.result.success) {
              resolve(res.result.data)
            } else {
              reject(new Error(res.result.message || res.result.error || '操作失败'))
            }
          } else {
            resolve(res.result)
          }
        },
        fail: (error) => {
          console.error(`云函数 ${name} 调用失败:`, error)
          reject(error)
        }
      })
    })
  }

  // 用户相关云函数
  user = {
    // 获取OpenID
    getOpenId: () => this.callFunction('quickstartFunctions', { type: 'getOpenId' }),
    
    // 用户登录
    login: (userInfo) => this.callFunction('quickstartFunctions', { 
      type: 'login', 
      userInfo 
    }),
    
    // 更新用户信息
    updateUserInfo: (userInfo) => this.callFunction('quickstartFunctions', { 
      type: 'updateUserInfo', 
      userInfo 
    }),
    
    // 获取用户信息
    getUserInfo: () => this.callFunction('quickstartFunctions', { type: 'getUserInfo' })
  }

  // 时间判断工具函数
  isMatchFinished = (matchData) => {
    if (!matchData.date || !matchData.timeSlot) {
      return false;
    }

    try {
      // 解析时间段，获取结束时间
      const timeSlotParts = matchData.timeSlot.split('-');
      if (timeSlotParts.length !== 2) {
        return false;
      }

      const endTime = timeSlotParts[1]; // 例如 "10:00"
      const [endHour, endMinute] = endTime.split(':').map(num => parseInt(num));

      // 构建活动结束时间
      const matchEndTime = new Date(matchData.date);
      matchEndTime.setHours(endHour, endMinute, 0, 0);

      // 与当前时间比较
      const now = new Date();
      return now > matchEndTime;
    } catch (error) {
      console.error('判断活动是否结束时出错:', error);
      return false;
    }
  }

  // 约球相关云函数
  match = {
    // 发布约球
    publish: (matchData) => this.callFunction('publish', { matchData }),

    // 获取约球列表
    getList: (page = 1, pageSize = 10, filters = {}) => this.callFunction('getMatchList', {
      page,
      pageSize,
      filters
    }),

    // 加入约球
    join: (matchId) => this.callFunction('join', { matchId }),

    // 退出约球
    leave: (matchId) => this.callFunction('quit', { matchId }),

    // 取消约球
    cancel: (matchId) => this.callFunction('delete', { matchId }),

    // 获取我参与的约球
    getMyJoined: () => this.callFunction('getMyJoined', {}),

    // 获取我发布的约球
    getMyPublished: () => this.callFunction('getMyPublished', {})
  }

  // 收藏相关云函数
  favorite = {
    // 收藏约球
    add: (matchId) => this.callFunction('favorite', { 
      type: 'addFavorite', 
      matchId 
    }),
    
    // 取消收藏
    remove: (matchId) => this.callFunction('favorite', { 
      type: 'removeFavorite', 
      matchId 
    }),
    
    // 获取收藏列表
    getList: (page = 1, pageSize = 10) => this.callFunction('favorite', { 
      type: 'getFavoriteList', 
      page, 
      pageSize 
    }),
    
    // 检查是否已收藏
    check: (matchId) => this.callFunction('favorite', { 
      type: 'checkFavorite', 
      matchId 
    })
  }

  // 数据库初始化
  initDatabase = {
    // 初始化所有内容
    initAll: () => this.callFunction('initDatabase', { type: 'initAll' }),
    
    // 初始化集合
    initCollections: () => this.callFunction('initDatabase', { type: 'initCollections' }),
    
    // 创建索引
    createIndexes: () => this.callFunction('initDatabase', { type: 'createIndexes' }),
    
    // 插入示例数据
    insertSampleData: () => this.callFunction('initDatabase', { type: 'insertSampleData' })
  }
}

// 创建全局云服务实例
const cloudService = new CloudService()

// 导出云服务实例
module.exports = cloudService