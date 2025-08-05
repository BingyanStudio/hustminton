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
    locationSelected: false,
    projectOptions: ['男单','女单','男双','女双','混双'],
    selectedProjects: [],
    selectedProjectIndexes: [], // 使用index数组来跟踪选中状态
    levelOptions: ['0-0.5','0.5-1','1-2','2以上'],
    levelIndex: 0,
    levelSelected: false,
    playerCounts: ['2人', '4人', '6人', '8人'],
    playerCountIndex: 0,
    playerCountSelected: false,
    recruitCount: [],
    recruitCountIndex: 0,
    recruitCountSelected: false,
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
      dateText: text,
      timeSelected: true
    });
  },
  onCloseTimeSheet() {
    this.setData({ showTimeSheet: false });
  },

  onLocationChange(e) {
    this.setData({
      locationIndex: e.detail.value,
      locationSelected: true
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
      levelIndex: e.detail.value,
      levelSelected: true
    })
  },

  onPlayerCountChange(e) {
    this.setData({
      playerCountIndex: e.detail.value,
      playerCountSelected: true
    }, () => {
      this.initRecruitCount();
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
      recruitCountIndex: e.detail.value,
      recruitCountSelected: true
    });
  },

  // 检查用户个人信息是否完整
  async checkUserProfileComplete() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getUserInfo'
        }
      });

      if (!res.result.success || !res.result.userInfo) {
        return {
          complete: false,
          message: '请先完善个人信息',
          detail: '系统未找到您的个人信息，请前往个人中心完善'
        };
      }

      const userInfo = res.result.userInfo;
      const missingFields = [];

      // 检查必填字段（不包括头像）
      if (!userInfo.nickname && !userInfo.nickName && !userInfo.name) {
        missingFields.push('昵称');
      }
      if (!userInfo.gender) {
        missingFields.push('性别');
      }
      if (!userInfo.birthdate) {
        missingFields.push('生日');
      }
      if (!userInfo.level) {
        missingFields.push('等级');
      }
      // 检查联系方式
      if (!userInfo.contactType || !userInfo.contactValue) {
        missingFields.push('联系方式');
      }

      if (missingFields.length > 0) {
        return {
          complete: false,
          message: `个人信息不完整`,
          detail: `缺少：${missingFields.join('、')}`,
          missingFields: missingFields
        };
      }

      return {
        complete: true,
        userInfo: userInfo
      };
    } catch (error) {
      console.error('检查用户信息失败:', error);
      return {
        complete: false,
        message: '获取用户信息失败',
        detail: '网络连接异常，请检查网络后重试'
      };
    }
  },

  // 检查发布信息是否完整
  checkPublishInfoComplete() {
    const { selectedDate, selectedTimeSlot, contact, selectedProjects } = this.data;
    const missingFields = [];

    if (!selectedDate) {
      missingFields.push('日期');
    }
    if (!selectedTimeSlot) {
      missingFields.push('时间段');
    }
    if (!contact || contact.trim() === '') {
      missingFields.push('联系方式');
    }
    if (!selectedProjects || selectedProjects.length === 0) {
      missingFields.push('运动项目');
    }

    if (missingFields.length > 0) {
      return {
        complete: false,
        message: `请填写完整信息：${missingFields.join('、')}`
      };
    }

    return { complete: true };
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

    // 1. 检查发布信息完整性
    const publishCheck = this.checkPublishInfoComplete();
    if (!publishCheck.complete) {
      wx.showToast({
        title: publishCheck.message,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    // 2. 检查用户个人信息完整性
    wx.showLoading({ title: '检查用户信息...' });
    const profileCheck = await this.checkUserProfileComplete();
    wx.hideLoading();

    if (!profileCheck.complete) {
      const content = profileCheck.detail ?
        `${profileCheck.message}\n${profileCheck.detail}\n\n是否前往个人中心完善信息？` :
        `${profileCheck.message}\n\n是否前往个人中心完善信息？`;

      wx.showModal({
        title: '个人信息检查',
        content: content,
        confirmText: '去完善',
        cancelText: '取消',
        confirmColor: '#007aff',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/profile/profile'
            });
          }
        }
      });
      return;
    }

    const { dateText, selectedDate, selectedTimeSlot, locationOptions, locationIndex, projectOptions, selectedProjects, levelOptions, levelIndex, playerCounts, playerCountIndex, description, contact } = this.data
    // 生成标题：地点+项目+时间
    const title = `${locationOptions[locationIndex]} ${selectedProjects.join('/')} ${dateText}`
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
    }
    try {
      console.log('开始发布约球信息到云服务器:', matchData);
      wx.showLoading({ title: '发布中...' });

      await cloudService.match.publish(matchData);

      wx.hideLoading();
      console.log('约球信息发布成功');

      // 显示成功提示
      wx.showModal({
        title: '发布成功',
        content: `约球信息已成功发布！\n\n${title}\n\n您可以在"我发布的"页面查看和管理您的约球信息。`,
        showCancel: false,
        confirmText: '返回首页',
        confirmColor: '#007aff',
        success: () => {
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
          });

          // 返回首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      });
    } catch (e) {
      wx.hideLoading();
      console.error('发布失败:', e);
      wx.showModal({
        title: '发布失败',
        content: e.message || '网络异常，请检查网络连接后重试',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#ff3b30'
      });
    }
  }
})