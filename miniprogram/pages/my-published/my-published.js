const cloudService = require('../../utils/cloud')

Page({
  data: {
    ongoingList: [],
    finishedList: [],
    expandedMatches: {}, // 用于控制卡片展开状态
    showProfileModal: false, // 控制个人信息弹窗
    profileUser: {} // 存储要显示的用户信息
  },
  onShow() {
    this.loadMyPublishedActivities();
    // 标记通知为已读
    this.markNotificationsAsRead();
  },

  // 标记通知为已读
  markNotificationsAsRead() {
    wx.cloud.callFunction({
      name: 'markNotificationsRead',
      success: (res) => {
        console.log('标记通知为已读成功');
      },
      fail: (err) => {
        console.error('标记通知为已读失败:', err);
      }
    });
  },
  loadMyPublishedActivities() {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'getMyPublished'
    }).then(res => {
      wx.hideLoading();
      if (res.result.success) {
        const data = res.result.data || {};

        // 合并所有活动，然后根据时间重新分类
        const allActivities = [...(data.ongoingList || []), ...(data.finishedList || [])];

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

        console.log('我发布的活动加载完成:', {
          ongoing: ongoingList.length,
          finished: finishedList.length
        });
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      console.error('加载发布活动失败', err);
    });
  },
  // 展开/收起卡片详情
  onToggleExpand(e) {
    const matchId = e.currentTarget.dataset.matchId;
    const expandedMatches = { ...this.data.expandedMatches };
    expandedMatches[matchId] = !expandedMatches[matchId];
    this.setData({ expandedMatches });
  },

  // 头像点击事件
  onAvatarTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击头像，用户ID:', id);

    let user = null;
    // 在正在进行的活动中查找
    for (const match of this.data.ongoingList) {
      user = (match.participants || []).find(p => p._id === id);
      if (user) {
        console.log('找到用户信息:', user);
        break;
      }
    }

    // 如果没找到，在已结束的活动中查找
    if (!user) {
      for (const match of this.data.finishedList) {
        user = (match.participants || []).find(p => p._id === id);
        if (user) {
          console.log('找到用户信息:', user);
          break;
        }
      }
    }

    if (user) {
      this.setData({ showProfileModal: true, profileUser: user });
    } else {
      console.log('未找到用户信息');
      wx.showToast({ title: '未找到用户信息', icon: 'none' });
    }
  },

  // 关闭个人信息弹窗
  onCloseProfileModal() {
    this.setData({ showProfileModal: false });
  },

  // 编辑活动
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/republish/republish?id=${id}`
    });
  }
});