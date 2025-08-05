const db = wx.cloud.database()
const matchCollection = db.collection('match')
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
    // 编辑模式相关
    isEditMode: false,
    matchId: '',
    originalMatchData: null
  },

  onLoad(options) {
    cloudService.init();
    this.initRecruitCount();

    // 检查是否是编辑模式
    if (options.id) {
      this.setData({
        isEditMode: true,
        matchId: options.id
      });
      this.loadMatchData(options.id);
    }

    console.log('页面加载，编辑模式:', this.data.isEditMode, '活动ID:', options.id);
  },

  // 加载活动数据（编辑模式）
  async loadMatchData(matchId) {
    try {
      wx.showLoading({ title: '加载中...' });

      // 直接查询数据库获取活动信息
      const result = await wx.cloud.database().collection('matches').doc(matchId).get();

      if (result.data) {
        const matchData = result.data;
        console.log('加载的活动数据:', matchData);

        // 预填充表单数据
        this.fillFormWithMatchData(matchData);

        // 保存原始数据
        this.setData({ originalMatchData: matchData });
      } else {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (error) {
      console.error('加载活动数据失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  // 用活动数据填充表单
  fillFormWithMatchData(matchData) {
    // 处理日期和时间
    const selectedDate = matchData.date || '';
    const selectedTimeSlot = matchData.timeSlot || '';
    const dateText = matchData.dateText || '请选择时间';

    // 处理地点
    const locationIndex = this.data.locationOptions.indexOf(matchData.location) || 0;

    // 处理项目（可能是数组或字符串）
    let selectedProjects = [];
    if (Array.isArray(matchData.project)) {
      selectedProjects = matchData.project;
    } else if (typeof matchData.project === 'string') {
      selectedProjects = [matchData.project];
    }

    // 根据选中的项目名称计算对应的index数组
    let selectedProjectIndexes = [];
    selectedProjects.forEach(projectName => {
      const index = this.data.projectOptions.indexOf(projectName);
      if (index !== -1) {
        selectedProjectIndexes.push(index);
      }
    });

    // 处理等级
    const levelIndex = this.data.levelOptions.indexOf(matchData.level) || 0;

    // 处理人数
    const playerCountStr = matchData.playerCount + '人';
    const playerCountIndex = this.data.playerCounts.indexOf(playerCountStr) || 0;

    // 设置数据
    this.setData({
      selectedDate,
      selectedTimeSlot,
      dateText,
      locationIndex,
      selectedProjects,
      selectedProjectIndexes,
      levelIndex,
      playerCountIndex,
      description: matchData.description || '',
      contact: matchData.contact || ''
    });

    // 重新初始化捞人人数选项
    this.initRecruitCount();

    // 设置捞人人数
    if (matchData.recruitCount) {
      const recruitCountStr = matchData.recruitCount + '人';
      const recruitCountIndex = this.data.recruitCount.indexOf(recruitCountStr) || 0;
      this.setData({ recruitCountIndex });
    }

    console.log('表单数据已填充:', {
      selectedDate,
      selectedTimeSlot,
      locationIndex,
      selectedProjects,
      selectedProjectIndexes,
      levelIndex,
      playerCountIndex,
      description: matchData.description,
      contact: matchData.contact
    });
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
      recruitCountIndex: e.detail.value
    });
  },

  async onSubmit() {
    const { dateText, selectedDate, selectedTimeSlot, locationOptions, locationIndex, selectedProjects, levelOptions, levelIndex, playerCounts, playerCountIndex, description, contact, isEditMode, matchId } = this.data

    // 验证表单
    if (!selectedDate || !selectedTimeSlot || !contact || selectedProjects.length === 0) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    // 生成标题：地点+项目+时间
    const title = `${locationOptions[locationIndex]} ${selectedProjects.join('/')} ${dateText}`

    const matchData = {
      title,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      dateText,
      location: locationOptions[locationIndex],
      project: selectedProjects,
      level: levelOptions[levelIndex],
      playerCount: parseInt(playerCounts[playerCountIndex]),
      recruitCount: parseInt(this.data.recruitCount[this.data.recruitCountIndex]) || 0,
      description,
      contact
    }

    try {
      if (isEditMode) {
        // 编辑模式：调用更新云函数
        await cloudService.callFunction('update', {
          matchId,
          ...matchData
        });
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        // 新建模式：调用发布云函数
        matchData.createTime = new Date().toISOString();

        await cloudService.callFunction('publish', { matchData });
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });

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
          description: '',
          contact: ''
        });
      }
    } catch (e) {
      console.error('提交失败:', e);
      wx.showToast({
        title: e.message || (isEditMode ? '更新失败' : '发布失败'),
        icon: 'none'
      });
    }
  },

  async onDelete() {
    const { isEditMode, matchId } = this.data;

    if (!isEditMode || !matchId) {
      wx.showToast({ title: '无法删除', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除此次约球活动吗？删除后无法恢复！',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });

            // 调用删除云函数
            await cloudService.callFunction('delete', { matchId });

            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            // 延迟返回，让用户看到成功提示
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);

          } catch (error) {
            wx.hideLoading();
            console.error('删除失败:', error);
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
})