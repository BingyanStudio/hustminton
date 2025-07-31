const cloudService = require('../../utils/cloud')

Page({
  data: {
    selectedDate: '',
    selectedTimeSlot: '',
    dateText: '请选择时间',
    showTimeSheet: false,
    timeSlotOptions: ['6:00-8:00', '8:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'],
    locationOptions: ['光体','西体','游泳馆','壁球馆'],
    locationIndex: 0,
    projectOptions: ['男单','女单','男双','女双','混双'],
    selectedProjects: [],
    selectedProjectIndexes: [], // 使用index数组来跟踪选中状态
    levelOptions: ['0-0.5','0.5-1','1-2','2以上'],
    levelIndex: 0,
    playerCounts: ['2人', '4人', '6人', '8人'],
    playerCountIndex: 0,
    recruitCount: [],
    recruitCountIndex: 0,
    description: '',
    contact: '',
    textareaWidth: 'auto',
  },

  onLoad() {
    // 确保云服务初始化成功
    const initResult = cloudService.init();
    if (!initResult) {
      wx.showToast({
        title: '云服务初始化失败',
        icon: 'none'
      })
    }
    this.initRecruitCount();
  },

  onDescriptionInput(e) {
    const value = e.detail.value;
    this.setData({
      description: value,
    });
  },

  onShow() {
    this.initRecruitCount();
    console.log('页面显示，当前selectedProjects:', this.data.selectedProjects);
  },

  onDatePickerChange(e) {
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
  },
  onCloseTimeSheet() {
    this.setData({ showTimeSheet: false });
  },

  onLocationChange(e) {
    this.setData({
      locationIndex: e.detail.value
    })
  },

  onProjectSelect(e) {
    console.log('=== onProjectSelect 被调用 ===');

    // 获取项目index和项目名
    const projectIndex = e.currentTarget.dataset.index;
    const project = e.currentTarget.dataset.project;
    console.log('点击的项目index:', projectIndex, '项目名:', project);

    if (projectIndex === undefined) {
      console.error('无法获取项目index');
      return;
    }

    // 获取当前选中的项目index数组和项目名数组
    let selectedProjectIndexes = [...(this.data.selectedProjectIndexes || [])];
    let selectedProjects = [...(this.data.selectedProjects || [])];
    console.log('当前选中项目indexes:', selectedProjectIndexes);
    console.log('当前选中项目:', selectedProjects);

    // 切换选中状态
    const indexPosition = selectedProjectIndexes.indexOf(projectIndex);
    if (indexPosition > -1) {
      // 取消选择
      selectedProjectIndexes.splice(indexPosition, 1);
      selectedProjects.splice(selectedProjects.indexOf(project), 1);
      console.log('取消选择:', project, 'index:', projectIndex);
    } else {
      // 添加选择
      selectedProjectIndexes.push(projectIndex);
      selectedProjects.push(project);
      console.log('添加选择:', project, 'index:', projectIndex);
    }

    console.log('新的选中项目indexes:', selectedProjectIndexes);
    console.log('新的选中项目:', selectedProjects);

    // 更新数据
    this.setData({
      selectedProjectIndexes: selectedProjectIndexes,
      selectedProjects: selectedProjects
    }, () => {
      console.log('数据更新完成，当前选中indexes:', this.data.selectedProjectIndexes);
      console.log('数据更新完成，当前选中项目:', this.data.selectedProjects);
    });
  },

  onLevelChange(e) {
    this.setData({
      levelIndex: e.detail.value
    })
  },

  onPlayerCountChange(e) {
    this.setData({
      playerCountIndex: e.detail.value
    }, () => {
      this.initRecruitCounts();
    });
  },

  initRecruitCount() {
    const playerCount = parseInt(this.data.playerCounts[this.data.playerCountIndex]) || 0;
    let recruitCount = [];
    if (playerCount > 1) {
      for (let i = 1; i < playerCount; i++) {
        recruitCount.push(i + '人');
      }
    }
    this.setData({
      recruitCount,
      recruitCountIndex: 0
    });
  },

  onRecruitCountChange(e) {
    this.setData({
      recruitCountIndex: e.detail.value
    });
  },

  async onSubmit() {
    // 检查云服务是否初始化成功
    if (!cloudService.isInitialized) {
      wx.showToast({
        title: '云服务未初始化，请重试',
        icon: 'none'
      })
      // 尝试重新初始化
      cloudService.init();
      return;
    }

    const { dateText, selectedDate, selectedTimeSlot, locationOptions, locationIndex, projectOptions, selectedProjects, levelOptions, levelIndex, playerCounts, playerCountIndex, description, contact } = this.data
    // 生成标题：地点+项目+时间
    const title = `${locationOptions[locationIndex]} ${selectedProjects.join('/')} ${dateText}`
    if (!selectedDate || !selectedTimeSlot || !contact || selectedProjects.length === 0) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }
    const matchData = {
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      dateText,
      location: locationOptions[locationIndex],
      project: selectedProjects,
      level: levelOptions[levelIndex],
      playerCount: parseInt(playerCounts[playerCountIndex]),
      // 使用用户选择的捞人人数
      recruitCount: parseInt(this.data.recruitCount[this.data.recruitCountIndex]) || 0,
      description,
      contact,
      createTime: new Date().toISOString(),
      status: 'active'
    }
    try {
      console.log('开始发布约球信息到云服务器:', matchData);
      await cloudService.match.publish(matchData);
      wx.showToast({
        title: '发布成功',
        icon: 'success'
      })
      console.log('约球信息发布成功');
      // 清空表单
      this.setData({
        selectedDate: '',
        selectedTimeSlot: '',
        dateText: '请选择时间',
        locationIndex: 0,
        selectedProjects: [],
        selectedProjectIndexes: [],
        levelIndex: 0,
        playerCountIndex: 0,
        recruitCountIndex: 0,
        description: '',
        contact: ''
      })
    } catch (e) {
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
    }
  }
})