// app.js
App({
  onLaunch: function () {
    // 尝试从本地存储加载用户信息
    const storedUserInfo = wx.getStorageSync('userInfo');
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "cloud1-7guleuaib5fb4758",
      userInfo: storedUserInfo || null,
      // 通知相关状态
      notifications: {
        myPublishedCount: 0, // 我发布的活动的新通知数量
        lastCheckTime: null  // 上次检查通知的时间
      }
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-7guleuaib5fb4758",
        traceUser: true,
      });

      // 启动时检查是否需要自动清理数据
      this.checkAutoCleanup();
    }
  },

  // 获取用户信息（按需调用）
  getUserInfo: function(callback) {
    // 如果已经有用户信息，直接返回
    if (this.globalData.userInfo) {
      callback && callback(this.globalData.userInfo);
      return;
    }

    // 尝试获取用户信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res.userInfo);
        this.globalData.userInfo = res.userInfo;
        callback && callback(res.userInfo);
      },
      fail: (err) => {
        console.log('获取用户信息失败，使用默认信息:', err);
        // 使用默认信息
        const defaultUserInfo = {
          nickName: '用户',
          avatarUrl: 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg'
        };
        this.globalData.userInfo = defaultUserInfo;
        callback && callback(defaultUserInfo);
      }
    });
  },

  // 确保用户记录存在（按需调用）
  ensureUserRecord: function(userInfo, callback) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'updateUserInfo',
        userInfo: userInfo
      },
      success: (cloudRes) => {
        console.log('用户记录确保成功:', cloudRes.result);
        callback && callback(true);
      },
      fail: (err) => {
        console.error('用户记录确保失败:', err);
        callback && callback(false);
      }
    });
  },

  // 通知管理方法
  // 更新我发布的活动通知数量
  updateMyPublishedNotifications: function(count) {
    this.globalData.notifications.myPublishedCount = count;
    // 更新tabBar红点
    if (count > 0) {
      wx.showTabBarRedDot({
        index: 2 // "我的"页面的索引
      });
    } else {
      wx.hideTabBarRedDot({
        index: 2
      });
    }
  },

  // 清除我发布的活动通知
  clearMyPublishedNotifications: function() {
    this.globalData.notifications.myPublishedCount = 0;
    this.globalData.notifications.lastCheckTime = new Date();
    wx.hideTabBarRedDot({
      index: 2
    });
  },

  // 获取通知数量
  getNotificationCount: function() {
    return this.globalData.notifications.myPublishedCount;
  },

  // 检查是否需要自动清理数据
  checkAutoCleanup: function() {
    try {
      const lastCleanupTime = wx.getStorageSync('lastAutoCleanup');
      const now = new Date().getTime();
      const cleanupInterval = 7 * 24 * 60 * 60 * 1000; // 7天间隔

      // 如果从未清理过，或者距离上次清理超过7天，则执行自动清理
      if (!lastCleanupTime || (now - new Date(lastCleanupTime).getTime()) > cleanupInterval) {
        console.log('触发自动数据清理');
        this.performAutoCleanup();
      } else {
        console.log('数据清理间隔未到，跳过自动清理');
      }
    } catch (error) {
      console.error('检查自动清理失败:', error);
    }
  },

  // 执行自动清理
  performAutoCleanup: function() {
    // 延迟3秒执行，避免影响小程序启动速度
    setTimeout(async () => {
      try {
        console.log('开始执行自动数据清理...');

        const response = await wx.cloud.callFunction({
          name: 'dataCleanup',
          data: { type: 'auto' }
        });

        console.log('自动清理云函数响应:', response);

        // 检查云函数调用是否成功
        if (!response || response.errCode) {
          throw new Error(response ? response.errMsg : '云函数调用失败');
        }

        const result = response.result || response;

        if (result && result.success) {
          console.log('自动数据清理完成:', result);

          // 记录清理时间
          const now = new Date().toISOString();
          wx.setStorageSync('lastAutoCleanup', now);

          // 可选：记录清理日志
          const logs = wx.getStorageSync('autoCleanupLogs') || [];
          logs.unshift({
            timestamp: now,
            success: true,
            results: result.results
          });

          // 只保留最近5条日志
          if (logs.length > 5) {
            logs.splice(5);
          }
          wx.setStorageSync('autoCleanupLogs', logs);

        } else {
          console.log('自动数据清理未执行或失败:', result);
        }
      } catch (error) {
        console.error('自动数据清理失败:', error);

        // 记录失败日志
        const logs = wx.getStorageSync('autoCleanupLogs') || [];
        logs.unshift({
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message || error.toString()
        });
        if (logs.length > 5) {
          logs.splice(5);
        }
        wx.setStorageSync('autoCleanupLogs', logs);
      }
    }, 3000); // 延迟3秒
  }
});
