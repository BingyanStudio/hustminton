const db = wx.cloud.database()
const matchCollection = db.collection('match')
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
      const result = await cloudService.callFunction('getMyJoined', {});
      console.log('获取到的数据:', result);

      // 合并所有活动，然后根据时间重新分类
      const allActivities = [...(result.ongoingList || []), ...(result.finishedList || [])];

      const ongoingList = [];
      const finishedList = [];

      allActivities.forEach(item => {
        const participantCount = item.participants ? item.participants.length : 0;
        const playerCount = parseInt(item.playerCount) || 0;
        const isFull = participantCount >= playerCount;
        const isFinished = cloudService.isMatchFinished(item);

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
    } catch (e) {
      wx.showToast({ title: e.message || '获取活动失败', icon: 'none' });
      console.error('获取活动失败:', e);
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