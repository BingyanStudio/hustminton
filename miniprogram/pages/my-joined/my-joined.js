const db = wx.cloud.database()
const matchCollection = db.collection('matches')
const cloudService = require('../../utils/cloud')

Page({
  data: {
    placeOptions: ['光体', '西体', '游泳馆', '壁球馆'],
    levelOptions: ['0-0.5', '0.5-1', '1-2', '2以上'],
    projectOptions: ['男单', '女单', '男双', '女双', '混双'],
    ongoingList: [],
    finishedList: [],
    expandedMatches: {},
    showProfileModal: false,
    profileUser: {}
  },
  onLoad() {
    this.loadMyJoinedActivities();
  },

  onShow() {
    this.loadMyJoinedActivities();
  },

  async loadMyJoinedActivities() {
    try {
      // 直接使用wx.cloud.callFunction，避免云服务初始化问题
      const response = await wx.cloud.callFunction({
        name: 'getMyJoined',
        data: {}
      });

      console.log('云函数响应:', response);

      // 检查响应是否成功
      if (!response || response.errCode) {
        throw new Error(response ? response.errMsg : '云函数调用失败');
      }

      const result = response.result;
      console.log('获取到的数据:', result);

      // 检查结果是否成功
      if (!result || !result.success) {
        throw new Error(result ? result.message : '获取数据失败');
      }

      const data = result.data || {};

      // 合并所有活动，然后根据时间重新分类
      const allActivities = [...(data.ongoingList || []), ...(data.finishedList || [])];

      // 时间判断工具函数
      function isMatchFinished(matchData) {
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

      const ongoingList = [];
      const finishedList = [];

      allActivities.forEach(item => {
        const participantCount = item.participants ? item.participants.length : 0;
        const playerCount = parseInt(item.playerCount) || 0;
        const isFull = participantCount >= playerCount;
        const isFinished = isMatchFinished(item);

        const processedItem = {
          ...item,
          isFull,
          participantCount,
          playerCount,
          isFinished
        };

        if (isFinished) {
          finishedList.push(processedItem);
        } else {
          ongoingList.push(processedItem);
        }
      });

      this.setData({
        ongoingList,
        finishedList
      });

      console.log('设置的数据:', {
        ongoingList: ongoingList.length,
        finishedList: finishedList.length,
        满员状态示例: ongoingList.length > 0 ? {
          活动: ongoingList[0].title,
          参与人数: ongoingList[0].participantCount,
          场地人数: ongoingList[0].playerCount,
          是否满员: ongoingList[0].isFull
        } : '无活动'
      });
    } catch (error) {
      console.error('获取活动失败:', error);
      wx.showToast({
        title: '获取活动失败: ' + (error.message || error),
        icon: 'none'
      });
    }
  },

  onBack() {
    wx.navigateBack();
  },
  onToggleExpand(e) {
    // 获取当前比赛ID
    const matchId = e.currentTarget.dataset.matchId;
    if (!matchId) return;

    // 获取当前展开状态并取反
    const expandedMatches = { ...this.data.expandedMatches };
    expandedMatches[matchId] = !expandedMatches[matchId];

    // 更新展开状态
    this.setData({ expandedMatches });
  },
  async onQuit(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认退出',
      content: '确定要退出该场活动吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数退出活动
            await cloudService.callFunction('quit', { matchId: id });
            // 重新加载数据
            this.loadMyJoinedActivities();
            wx.showToast({ title: '已退出', icon: 'success' });
          } catch (error) {
            console.error('退出活动失败:', error);
            wx.showToast({ title: error.message || '退出失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 头像点击事件
  onAvatarTap(e) {
    const userId = e.currentTarget.dataset.id;
    console.log('点击头像，用户ID:', userId);

    let userInfo = null;
    // 在正在进行的活动中查找用户
    for (const match of this.data.ongoingList) {
      userInfo = (match.participants || []).find(person => person._id === userId);
      if (userInfo) break;
    }

    // 如果没找到，在已结束的活动中查找
    if (!userInfo) {
      for (const match of this.data.finishedList) {
        userInfo = (match.participants || []).find(person => person._id === userId);
        if (userInfo) break;
      }
    }

    if (userInfo) {
      this.setData({
        showProfileModal: true,
        profileUser: userInfo
      });
    } else {
      wx.showToast({ title: '未找到用户信息', icon: 'none' });
    }
  },

  // 关闭个人信息弹窗
  onCloseProfileModal() {
    this.setData({ showProfileModal: false });
  }
});