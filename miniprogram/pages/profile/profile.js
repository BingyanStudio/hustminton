// profile.js
// 引入云服务工具类
const cloudService = require('../../utils/cloud.js')

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickname: '',
      gender: '',
      birthdate: '',
      level: ''
    },
    showProfilePopup: false,
    genderOptions: ['男', '女'],
    genderIndex: 0,
    editNickName: '',
    editBirthdate: '',
    editLevel: '',
    currentDate: '',
    // 通知相关
    myPublishedNotificationCount: 0
  },

  onLoad() {
    // 获取当前日期
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentDate = `${year}-${month}`;

    this.setData({ currentDate });

    // 获取用户信息
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时检查通知
    this.checkNotifications();
  },

  // 加载用户信息
  loadUserInfo() {
    const app = getApp();

    // 先尝试从全局获取
    if (app.globalData.userInfo) {
      this.setUserInfo(app.globalData.userInfo);
      this.loadUserProfile();
      return;
    }

    // 如果没有，则获取用户信息
    app.getUserInfo((userInfo) => {
      this.setUserInfo(userInfo);
      this.loadUserProfile();
    });
  },

  // 设置用户基础信息
  setUserInfo(userInfo) {
    this.setData({
      'userInfo.avatarUrl': userInfo.avatarUrl,
      'userInfo.nickname': userInfo.nickName,
      editNickName: userInfo.nickName
    });
  },

  // 计算年龄
  calculateAge(birthdate) {
    if (!birthdate) return '';
    try {
      // 处理不同格式的出生日期
      let dateStr = birthdate;
      // 处理 YYYY 格式
      if (/^\d{4}$/.test(birthdate)) {
        dateStr = `${birthdate}-01-01`;
      }
      // 处理 YYYY-M 或 YYYY-MM 格式
      else if (/^\d{4}-\d{1,2}$/.test(birthdate)) {
        const parts = birthdate.split('-');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        dateStr = `${year}-${month}-01`;
      }

      const birthDate = new Date(dateStr);
      const birthYear = birthDate.getFullYear();
      const birthMonth = birthDate.getMonth();
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      let age = currentYear - birthYear;
      // 如果当前月份小于出生月份，年龄减1
      if (currentMonth < birthMonth) {
        age--;
      }

      // 返回字符串类型的年龄，0岁时返回"0"
      return age >= 0 ? age.toString() : '';
    } catch (error) {
      console.error('年龄计算失败:', error, 'birthdate:', birthdate);
      return '';
    }
  },

  // 从云端加载用户详细资料
  loadUserProfile() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getUserInfo'
      },
      success: (res) => {
        console.log('获取用户资料结果:', res.result);
        if (res.result.success && res.result.userInfo) {
          const userData = res.result.userInfo;
          const age = this.calculateAge(userData.birthdate);
          this.setData({
            'userInfo.gender': userData.gender || '',
            'userInfo.birthdate': userData.birthdate || '',
            'userInfo.level': userData.level || '',
            'userInfo.age': age || '',
            editBirthdate: userData.birthdate || '',
            editLevel: userData.level || '',
            genderIndex: userData.gender === '女' ? 1 : 0
          });
        } else {
          console.log('用户资料不存在，使用默认值');
        }
      },
      fail: (err) => {
        console.error('获取用户资料失败:', err);
      }
    });
  },

  // 检查通知数量
  checkNotifications() {
    wx.cloud.callFunction({
      name: 'checkNotifications',
      success: (res) => {
        if (res.result.success) {
          const count = res.result.data.myPublishedCount;
          this.setData({
            myPublishedNotificationCount: count
          });

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

  // 上传头像
  onAvatarUpload() {
    // 确保云开发环境初始化
    if (!cloudService.isInitialized) {
      const initResult = cloudService.init()
      if (!initResult) {
        wx.showToast({
          title: '云服务初始化失败',
          icon: 'none'
        })
        return
      }
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择图片成功', res)
        const tempFilePaths = res.tempFilePaths
        
        // 显示裁剪界面
        wx.navigateTo({
          url: `/pages/crop/crop?src=${encodeURIComponent(tempFilePaths[0])}`,
          fail: (err) => {
            console.error('跳转裁剪页面失败', err)
            wx.showToast({
              title: '跳转失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('选择图片失败', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },
  
  // 接收裁剪后的头像
  onCropComplete(avatarUrl) {
    console.log('收到裁剪后的头像', avatarUrl)

    if (!avatarUrl) {
      wx.showToast({
        title: '裁剪失败',
        icon: 'none'
      })
      return
    }

    // crop页面已经完成了上传和数据库更新，这里只需要更新UI
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    })

    wx.showToast({
      title: '头像更新成功',
      icon: 'success'
    })
  },


  // 显示个人信息弹窗
  onProfileInfo() {
    this.setData({
      showProfilePopup: true,
      editNickName: this.data.userInfo.nickname,
      editBirthdate: this.data.userInfo.birthdate || '',
      editLevel: this.data.userInfo.level || '',
      genderIndex: this.data.genderOptions.indexOf(this.data.userInfo.gender) !== -1 ? this.data.genderOptions.indexOf(this.data.userInfo.gender) : 0
    })
  },

  // 出生年月选择
  onBirthdateChange(e) {
    this.setData({
      editBirthdate: e.detail.value
    })
  },

  // 关闭个人信息弹窗
  closeProfilePopup() {
    this.setData({
      showProfilePopup: false
    })
  },

  // 跳转到我发布的页面
  onMyPublished() {
    // 清除通知
    const app = getApp();
    app.clearMyPublishedNotifications();

    // 更新本地状态
    this.setData({
      myPublishedNotificationCount: 0
    });

    wx.navigateTo({
      url: '/pages/my-published/my-published'
    })
  },

  // 跳转到我参加的页面
  onMyJoined() {
    wx.navigateTo({
      url: '/pages/my-joined/my-joined'
    })
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({
      editNickName: e.detail.value
    })
  },

  // 年龄输入
  onAgeInput(e) {
    this.setData({
      editAge: e.detail.value
    })
  },

  // 等级输入
  onLevelInput(e) {
    this.setData({
      editLevel: e.detail.value
    })
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({
      genderIndex: e.detail.value
    })
  },

  // 保存个人信息
  async onProfileSave() {
    const { editNickName, editBirthdate, editLevel, genderOptions, genderIndex } = this.data;
    
    // 检查资料完整性
    if (!editNickName || !editBirthdate || !editLevel) {
      wx.showToast({
        title: '请完善个人资料',
        icon: 'none'
      })
      return
    }
    
    // 更新本地数据
    this.setData({
      'userInfo.nickname': editNickName,
      'userInfo.birthdate': editBirthdate,
      'userInfo.gender': genderOptions[genderIndex],
      'userInfo.level': editLevel,
      showProfilePopup: false
    })
    
    // 保存到云数据库
    try {
      const userInfo = {
        nickname: editNickName,
        birthdate: editBirthdate,
        gender: genderOptions[genderIndex],
        level: editLevel,
        avatarUrl: this.data.userInfo.avatarUrl
      }
      
      await cloudService.user.updateUserInfo(userInfo)
      
      wx.showToast({
        title: '信息已保存',
        icon: 'success'
      })
    } catch (e) {
      console.error('保存个人信息失败', e)
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    }
  }
})