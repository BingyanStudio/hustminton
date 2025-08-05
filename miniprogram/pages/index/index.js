// index.js
const cloudService = require('../../utils/cloud')

Page({
  data: {
    dateText: '不限',
    selectedDate: '',
    selectedTimeSlot: '',
    showTimeSheet: false,
    timeSlotOptions: ['不限', '6:00-8:00', '8:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'],
    projectOptions: ['不限', '男单', '女单', '男双', '女双', '混双'],
    projectIndex: 0,
    locationOptions: ['不限', '光体', '西体', '游泳馆', '壁球馆'],
    locationIndex: 0,
    levelOptions: ['不限', '0-0.5', '0.5-1', '1-2', '2以上'],
    levelIndex: 0,
    matchList: [],
    page: 1,
    hasMore: true,
    loading: false,
    showProfileModal: false,
    profileUser: null,
    expandedMatches: {},
  },
  
  async onLoad() {
    console.log('Index page loaded');
    // 测试方法绑定
    console.log('onDatePickerChange method exists:', typeof this.onDatePickerChange === 'function');
    // 确保云服务初始化成功
    const initResult = cloudService.init();
    if (!initResult) {
      wx.showToast({
        title: '云服务初始化失败',
        icon: 'none'
      })
    }

    this.loadMatchList();
  },

  // 切换赛事详情展开/收起状态
  onToggleExpand(e) {
    const { matchId } = e.currentTarget.dataset
    const { expandedMatches } = this.data
    // 切换状态
    expandedMatches[matchId] = !expandedMatches[matchId]
    this.setData({
      expandedMatches
    })
  },

  onShow() {
    console.log('Index页面显示，当前matchList长度:', this.data.matchList.length);
    // 每次显示页面时刷新数据，避免重复
    this.loadMatchList(true);
    // 检查通知
    this.checkNotifications();
  },

  // 检查通知数量
  checkNotifications() {
    wx.cloud.callFunction({
      name: 'checkNotifications',
      success: (res) => {
        if (res.result.success) {
          const count = res.result.data.myPublishedCount;
          // 更新全局状态
          const app = getApp();
          app.updateMyPublishedNotifications(count);
        }
      },
      fail: (err) => {
        console.error('检查通知失败:', err);
      }
    });
  },

  // 修复日期选择器变更事件处理函数
  onDatePickerChange(e) {
    console.log('Date picker changed:', e.detail.value);
    this.setData({
      selectedDate: e.detail.value,
      showTimeSheet: true
    });
  },

  onTimeSlotSelect(e) {
    const idx = e.currentTarget.dataset.index;
    const slot = this.data.timeSlotOptions[idx];
    let text = '不限';
    if (this.data.selectedDate && slot && slot !== '不限') {
      text = `${this.data.selectedDate} ${slot}`;
    } else if (this.data.selectedDate) {
      text = this.data.selectedDate;
    } else if (slot && slot !== '不限') {
      text = slot;
    }
    this.setData({
      selectedTimeSlot: slot,
      showTimeSheet: false,
      dateText: text
    });
    this.loadMatchList(true);
  },

  onCloseTimeSheet() {
    this.setData({ showTimeSheet: false });
  },

  onProjectChange(e) {
    this.setData({ projectIndex: e.detail.value });
    this.loadMatchList(true);
  },
  onLocationChange(e) {
    this.setData({ locationIndex: e.detail.value });
    this.loadMatchList(true);
  },
  onLevelChange(e) {
    this.setData({ levelIndex: e.detail.value });
    this.loadMatchList(true);
  },

  // 加载约球列表（云端）
  async loadMatchList(refresh = false) {
    console.log(`开始加载数据，refresh: ${refresh}, 当前matchList长度: ${this.data.matchList.length}`);
    if (this.data.loading) {
      console.log('正在加载中，跳过本次请求');
      return;
    }
    this.setData({ loading: true });
    if (refresh) {
      console.log('刷新模式：清空现有数据并重置页码');
      this.setData({ page: 1, matchList: [] });
    }
    // 构建筛选条件
    const params = {
      page: this.data.page,
      pageSize: 10
    };

    // 添加各种筛选条件
    if (this.data.locationOptions[this.data.locationIndex] !== '不限') {
      params.location = this.data.locationOptions[this.data.locationIndex];
    }
    if (this.data.projectOptions[this.data.projectIndex] !== '不限') {
      params.project = [this.data.projectOptions[this.data.projectIndex]]; // 转换为数组
    }
    if (this.data.levelOptions[this.data.levelIndex] !== '不限') {
      params.level = this.data.levelOptions[this.data.levelIndex];
    }
    if (this.data.selectedDate) {
      params.date = this.data.selectedDate;
    }
    if (this.data.selectedTimeSlot && this.data.selectedTimeSlot !== '不限') {
      params.timeSlot = this.data.selectedTimeSlot;
    }

    console.log('发送到云函数的参数:', params);

    try {
      const res = await cloudService.callFunction('getMatchList', params);
      console.log('云函数返回的原始数据:', res);

      let matchList = refresh ? res.list : [...this.data.matchList, ...res.list];
      console.log('合并后的原始matchList:', matchList);

      // 去除重复项（基于_id）
      const uniqueMatchList = [];
      const seenIds = new Set();
      for (const item of matchList) {
        if (!seenIds.has(item._id)) {
          seenIds.add(item._id);
          uniqueMatchList.push(item);
        }
      }
      matchList = uniqueMatchList;
      console.log('去重后的matchList:', matchList);

      // 添加满员判断逻辑和时间判断逻辑
      matchList = matchList
        .map(item => {
          const participantCount = item.participants ? item.participants.length : 0;
          const playerCount = parseInt(item.playerCount) || 0;
          const isFull = participantCount >= playerCount;
          const isFinished = cloudService.isMatchFinished(item);

          return {
            ...item,
            isFull,
            participantCount,
            playerCount,
            isFinished
          };
        })
        .filter(item => {
          // index页面逻辑：只显示状态为active或时间未结束的活动
          const shouldShow = item.status === 'active' || !item.isFinished;
          console.log(`活动 ${item._id} 过滤结果:`, {
            status: item.status,
            isFinished: item.isFinished,
            shouldShow: shouldShow,
            date: item.date,
            timeSlot: item.timeSlot
          });
          return shouldShow;
        });

      // 添加调试信息
      console.log('过滤后的活动列表:', matchList);
      console.log('过滤后的活动数量:', matchList.length);

      if (matchList.length > 0) {
        console.log('第一个活动的详细信息:', matchList[0]);
      }

      this.setData({
        matchList,
        loading: false,
        hasMore: res.hasMore
      });

      console.log(`数据加载完成，最终matchList长度: ${matchList.length}, hasMore: ${res.hasMore}`);
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 赛事卡片展开/收起


  // 头像点击事件
  onAvatarTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击头像，用户ID:', id);

    let user = null;
    for (const match of this.data.matchList) {
      // 在participants数组中查找用户，使用_id字段
      user = (match.participants || []).find(p => p._id == id || p.userId == id);
      if (user) {
        console.log('找到用户信息:', user);
        break;
      }
    }

    if (user) {
      this.setData({ showProfileModal: true, profileUser: user });
    } else {
      console.log('未找到用户信息，当前matchList:', this.data.matchList);
      wx.showToast({ title: '未找到用户信息', icon: 'none' });
    }
  },
  onCloseProfileModal() {
    this.setData({ showProfileModal: false });
  },


  // 约球详情、加入、加载更多、发布等函数保持不变...
  onMatchDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/match-detail/match-detail?id=${id}` });
  },
  onJoinMatch(e) {
    const id = e.currentTarget.dataset.id;

    // 查找对应的活动数据
    const matchData = this.data.matchList.find(item => item._id === id);
    if (!matchData) {
      wx.showToast({ title: '活动不存在', icon: 'none' });
      return;
    }

    // 检查是否满员
    const participantCount = matchData.participants ? matchData.participants.length : 0;
    const playerCount = parseInt(matchData.playerCount) || 0;
    const isFull = participantCount >= playerCount;

    if (isFull) {
      wx.showModal({
        title: '无法加入',
        content: `该场地已满员（${participantCount}/${playerCount}人），无法加入。`,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#ff3b30'
      });
      return;
    }

    // 检查用户是否已经参与
    const currentUser = wx.getStorageSync('userInfo');
    if (currentUser && matchData.participants) {
      const isAlreadyJoined = matchData.participants.some(p => p._id === currentUser.openid);
      if (isAlreadyJoined) {
        wx.showToast({ title: '您已参与该活动', icon: 'none' });
        return;
      }
    }

    // 显示加入确认对话框
    wx.showModal({
      title: '确认加入',
      content: `确定要加入这个约球活动吗？\n当前人数：${participantCount}/${playerCount}人`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '加入中...' });
            await cloudService.callFunction('join', { matchId: id });
            wx.hideLoading();
            // 使用showModal实现带小字的提示
            wx.showModal({
              title: '加入成功',
              content: '可在“我参与的”退出',
            });

            // 重新加载数据以更新状态
            this.loadMatchList(true);
          } catch (e) {
            wx.hideLoading();
            console.error('加入失败:', e);
            wx.showToast({ title: e.message || '加入失败', icon: 'none' });
          }
        }
      }
    });
  },
  
  onLoadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.loadMatchList();
      });
    }
  },
  onPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },
  onPullDownRefresh() {
    this.loadMatchList(true);
    wx.stopPullDownRefresh();
  }
})
