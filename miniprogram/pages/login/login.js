// pages/login/login.js
// 引入云服务工具类
const cloudService = require('../../utils/cloud.js')

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLoading: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 使用云服务实例
    this.cloudService = cloudService
    this.cloudService.init()

    // 检查用户是否已登录
    this.checkLoginStatus()
  },

  /**
   * 检查用户登录状态
   */
  checkLoginStatus() {
    wx.getStorage({
      key: 'userInfo',
      success: (res) => {
        // 用户已登录，直接跳转到首页
        this.navigateToHome()
      },
      fail: () => {
        // 用户未登录，显示登录页面
        console.log('用户未登录')
      }
    })
  },

  /**
   * 处理微信登录
   */
  handleLogin(e) {
    if (!e.detail.userInfo) {
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      })
      return
    }

    this.setData({
      isLoading: true
    })

    // 保存微信用户信息
    this.wechatUserInfo = e.detail.userInfo

    // 直接继续登录流程，不获取手机号
    this.proceedWithLogin()
  },

  /**
   * 继续登录流程
   */
  proceedWithLogin() {
    // 只保留必要的信息
    const filteredUserInfo = {}

    console.log('准备登录的用户信息:', filteredUserInfo)

    // 调用云函数进行登录
    this.cloudService.user.login(filteredUserInfo)
      .then(res => {
        // 登录成功，存储用户信息
        wx.setStorage({
          key: 'userInfo',
          data: res
        })

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 跳转到首页
        setTimeout(() => {
          this.navigateToHome()
        }, 1500)
      })
      .catch(error => {
        console.error('登录失败:', error)
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        })
      })
      .finally(() => {
        this.setData({
          isLoading: false
        })
      })
  },

  /**
   * 跳转到首页
   */
  navigateToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },


})