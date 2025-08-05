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
      level: '',
      phoneNumber: '',
      contactType: '',
      contactValue: ''
    },
    showProfilePopup: false,
    genderOptions: ['男', '女'],
    genderIndex: 0,
    contactOptions: ['电话', 'QQ', '微信'],
    contactIndex: 0,
    editNickName: '',
    editBirthdate: '',
    editLevel: '',
    editContactValue: '',
    currentDate: '',
    // 通知相关
    myPublishedNotificationCount: 0,
    // 意见反馈相关
    showFeedbackModal: false,
    feedbackContact: '',
    feedbackContent: '',
    isSubmitting: false,

    // 等级说明相关
    showLevelHelp: false
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
    // 直接从云端加载完整的用户信息，不再依赖微信授权信息
    this.loadUserProfile();
  },

  // 设置用户基础信息（仅在云端没有数据时使用）
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

          // 设置完整的用户信息，包括昵称和头像
          console.log('从云端加载的用户数据:', {
            avatarUrl: userData.avatarUrl,
            nickname: userData.nickname,
            nickName: userData.nickName,
            name: userData.name
          });

          // 过滤微信头像URL，只使用用户自定义上传的头像
          let avatarUrl = 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg'
          if (userData.avatarUrl &&
              !userData.avatarUrl.includes('thirdwx.qlogo.cn') &&
              !userData.avatarUrl.includes('wx.qlogo.cn')) {
            avatarUrl = userData.avatarUrl
          }

          this.setData({
            'userInfo.avatarUrl': avatarUrl,
            'userInfo.nickname': userData.nickname || userData.nickName || userData.name || '用户',
            'userInfo.gender': userData.gender || '',
            'userInfo.birthdate': userData.birthdate || '',
            'userInfo.level': userData.level || '',
            'userInfo.phoneNumber': userData.phoneNumber || '',
            'userInfo.contactType': userData.contactType || '',
            'userInfo.contactValue': userData.contactValue || '',
            'userInfo.age': age || '',
            editNickName: userData.nickname || userData.nickName || userData.name || '用户',
          editBirthdate: userData.birthdate || '',
          editLevel: userData.level || '',
          editContactValue: userData.contactValue || userData.phoneNumber || '',
          genderIndex: userData.gender === '女' ? 1 : 0,
          contactIndex: this.data.contactOptions.indexOf(userData.contactType) !== -1 ? this.data.contactOptions.indexOf(userData.contactType) : 0
          });

          // 保存用户信息到本地存储
          wx.setStorageSync('userInfo', this.data.userInfo);

          console.log('设置后的用户信息:', this.data.userInfo);
        } else {
          console.log('用户资料不存在，获取微信基础信息');
          // 如果云端没有用户信息，则获取微信基础信息
          this.getWechatUserInfo();
        }
      },
      fail: (err) => {
        console.error('获取用户资料失败:', err);
        // 获取失败时，尝试获取微信基础信息
        this.getWechatUserInfo();
      }
    });
  },

  // 获取微信用户基础信息（仅在云端没有数据时使用）
  getWechatUserInfo() {
    const app = getApp();
    app.getUserInfo((userInfo) => {
      console.log('使用微信基础信息:', userInfo);
      this.setData({
        'userInfo.avatarUrl': userInfo.avatarUrl || 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg',
        'userInfo.nickname': userInfo.nickName || '用户',
        'userInfo.phoneNumber': '',
        editNickName: userInfo.nickName || '用户',
          editContactValue: ''
      });

      // 保存用户信息到本地存储
      wx.setStorageSync('userInfo', this.data.userInfo);
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

  // 联系方式类型选择事件
  onContactTypeChange(e) {
    this.setData({
      contactIndex: e.detail.value
    });
  },

  // 联系方式值输入事件
  onContactValueInput(e) {
    this.setData({
      editContactValue: e.detail.value
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
      editContactValue: this.data.userInfo.contactValue || this.data.userInfo.phoneNumber || '',
      genderIndex: this.data.genderOptions.indexOf(this.data.userInfo.gender) !== -1 ? this.data.genderOptions.indexOf(this.data.userInfo.gender) : 0,
      contactIndex: this.data.contactOptions.indexOf(this.data.userInfo.contactType) !== -1 ? this.data.contactOptions.indexOf(this.data.userInfo.contactType) : 0
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

  // 显示等级说明
  onShowLevelHelp() {
    this.setData({
      showLevelHelp: true
    })
  },

  // 关闭等级说明
  onCloseLevelHelp() {
    this.setData({
      showLevelHelp: false
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
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
    const { editNickName, editBirthdate, editLevel, editContactValue, genderOptions, genderIndex, contactOptions, contactIndex } = this.data;
    
    // 检查资料完整性
    if (!editNickName || !editBirthdate || !editLevel || !editContactValue) {
      wx.showToast({
        title: '请完善个人资料',
        icon: 'none'
      })
      return
    }
    
    // 验证联系方式格式
    const contactType = contactOptions[contactIndex];
    if (editContactValue) {
      if (contactType === '电话' && !/^1[3-9]\d{9}$/.test(editContactValue)) {
        wx.showToast({
          title: '请输入有效的手机号',
          icon: 'none'
        });
        return;
      } else if (contactType === 'QQ' && !/^[1-9]\d{4,10}$/.test(editContactValue)) {
        wx.showToast({
          title: '请输入有效的QQ号',
          icon: 'none'
        });
        return;
      } else if (contactType === '微信' && !/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(editContactValue)) {
        wx.showToast({
          title: '请输入有效的微信号',
          icon: 'none'
        });
        return;
      }
    }
    
    // 更新本地数据
    this.setData({
      'userInfo.nickname': editNickName,
      'userInfo.birthdate': editBirthdate,
      'userInfo.gender': genderOptions[genderIndex],
      'userInfo.level': editLevel,
      'userInfo.contactType': contactType,
      'userInfo.contactValue': editContactValue || '',
      showProfilePopup: false
    })

    // 更新本地存储
    wx.setStorageSync('userInfo', this.data.userInfo);

    // 保存到云数据库
    try {
      const userInfo = {
        nickname: editNickName,
        birthdate: editBirthdate,
        gender: genderOptions[genderIndex],
        level: editLevel,
        contactType: contactType,
        contactValue: editContactValue || ''
      }

      // 只有当头像不是微信头像时才保存
      const currentAvatarUrl = this.data.userInfo.avatarUrl
      if (currentAvatarUrl &&
          !currentAvatarUrl.includes('thirdwx.qlogo.cn') &&
          !currentAvatarUrl.includes('wx.qlogo.cn') &&
          currentAvatarUrl !== 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg') {
        userInfo.avatarUrl = currentAvatarUrl
      }

      console.log('准备保存的用户信息:', userInfo);
      await cloudService.user.updateUserInfo(userInfo);
      console.log('用户信息保存成功');
      
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
  },

  // 意见反馈相关方法
  onFeedback() {
    this.setData({
      showFeedbackModal: true,
      feedbackContact: '',
      feedbackContent: '',
      isSubmitting: false
    });
  },

  onCloseFeedback() {
    this.setData({ showFeedbackModal: false });
  },



  onContactInput(e) {
    this.setData({
      feedbackContact: e.detail.value
    });
  },

  onContentInput(e) {
    this.setData({
      feedbackContent: e.detail.value
    });
  },

  onSubmitFeedback() {
    console.log('=== 反馈提交开始 ===');
    console.log('点击了提交按钮');

    const { feedbackContact, feedbackContent } = this.data;
    console.log('反馈数据:', { feedbackContact, feedbackContent });

    // 先测试基本功能
    wx.showToast({
      title: '按钮点击成功',
      icon: 'success'
    });

    if (!feedbackContent || feedbackContent.trim() === '') {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      });
      return;
    }

    // 显示反馈内容确认
    wx.showModal({
      title: '确认提交',
      content: `反馈内容：${feedbackContent}\n联系方式：${feedbackContact || '未填写'}`,
      success: (res) => {
        if (res.confirm) {
          this.doSubmitFeedback();
        }
      }
    });
  },

  async doSubmitFeedback() {
    console.log('开始实际提交反馈');

    this.setData({ isSubmitting: true });

    try {
      const { feedbackContact, feedbackContent } = this.data;
      const app = getApp();
      const userInfo = app.globalData.userInfo || {};

      const feedbackData = {
        type: '用户反馈',
        contact: feedbackContact,
        content: feedbackContent,
        userInfo: {
          nickName: userInfo.nickName || '匿名用户',
          avatarUrl: userInfo.avatarUrl || ''
        },
        timestamp: new Date().toISOString()
      };

      console.log('准备调用云函数，数据:', feedbackData);

      // 直接调用邮件发送云函数
      const result = await wx.cloud.callFunction({
        name: 'sendEmail',
        data: {
          feedbackData: feedbackData
        }
      });

      console.log('云函数调用结果:', result);

      if (result.result && result.result.success) {
        wx.showToast({
          title: '反馈提交成功',
          icon: 'success'
        });

        this.setData({
          showFeedbackModal: false,
          feedbackContact: '',
          feedbackContent: ''
        });
      } else {
        throw new Error(result.result?.message || '提交失败');
      }

    } catch (error) {
      console.error('提交反馈失败:', error);
      wx.showModal({
        title: '提交失败',
        content: error.message || '请稍后重试',
        showCancel: false
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？退出后需要重新授权登录。',
      confirmText: '确定退出',
      cancelText: '取消',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          this.performLogout();
        }
      }
    });
  },

  // 执行退出登录
  performLogout() {
    wx.showLoading({
      title: '退出中...'
    });

    try {
      // 清除本地存储的用户信息
      wx.removeStorageSync('userInfo');

      // 清除全局数据
      const app = getApp();
      if (app.globalData) {
        app.globalData.userInfo = null;
        app.globalData.openid = null;
      }

      wx.hideLoading();

      wx.showToast({
        title: '已退出登录',
        icon: 'success',
        duration: 1500
      });

      // 延迟跳转到登录页面
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('退出登录失败:', error);
      wx.showToast({
        title: '退出失败，请重试',
        icon: 'none'
      });
    }
  }
})