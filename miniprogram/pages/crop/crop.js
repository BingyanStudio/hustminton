// crop.js
Page({
  data: {
    imageSrc: '',
    cropperWidth: 280, // 匹配CSS中的560rpx (560/2=280px)
    cropperHeight: 280,
    cropperLeft: 0,
    cropperTop: 0,
    imageWidth: 0,
    imageHeight: 0,
    scale: 1,
    minScale: 0.3,
    maxScale: 4,
    // 触摸相关
    lastTouchDistance: 0,
    isScaling: false
  },

  onLoad(options) {
    if (options.src) {
      const imageSrc = decodeURIComponent(options.src)
      this.setData({ imageSrc })
      this.loadImageInfo(imageSrc)
    }
  },

  // 获取图片信息
  loadImageInfo(src) {
    wx.getImageInfo({
      src: src,
      success: (res) => {
        console.log('图片信息:', res)
        const { width, height } = res
        this.setData({
          imageWidth: width,
          imageHeight: height
        })
        this.initCropper()
      },
      fail: (err) => {
        console.error('获取图片信息失败', err)
        wx.showToast({
          title: '图片加载失败',
          icon: 'none'
        })
      }
    })
  },

  // 初始化裁剪器
  initCropper() {
    const { imageWidth, imageHeight, cropperWidth, cropperHeight } = this.data

    // 计算合适的初始缩放比例，让图片稍微大于裁剪框
    const scaleToFitWidth = cropperWidth / imageWidth
    const scaleToFitHeight = cropperHeight / imageHeight
    const minFitScale = Math.max(scaleToFitWidth, scaleToFitHeight) // 确保图片能覆盖整个裁剪框

    // 初始缩放比例稍微大一点，给用户调整空间
    const initialScale = Math.min(minFitScale * 1.2, this.data.maxScale)

    this.setData({
      scale: initialScale,
      minScale: minFitScale * 0.8, // 动态设置最小缩放
      cropperLeft: (cropperWidth - imageWidth * initialScale) / 2,
      cropperTop: (cropperHeight - imageHeight * initialScale) / 2
    })
  },

  // 图片触摸开始
  onImageTouchStart(e) {
    if (e.touches.length === 1) {
      // 单指触摸 - 准备拖动
      this.startX = e.touches[0].clientX
      this.startY = e.touches[0].clientY
      this.startLeft = this.data.cropperLeft
      this.startTop = this.data.cropperTop
      this.setData({ isScaling: false })
    } else if (e.touches.length === 2) {
      // 双指触摸 - 准备缩放
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      this.setData({
        lastTouchDistance: distance,
        isScaling: true
      })
      this.startScale = this.data.scale
    }
  },

  // 图片触摸移动
  onImageTouchMove(e) {
    if (e.touches.length === 1 && !this.data.isScaling) {
      // 单指移动 - 拖动图片
      const deltaX = e.touches[0].clientX - this.startX
      const deltaY = e.touches[0].clientY - this.startY

      let newLeft = this.startLeft + deltaX
      let newTop = this.startTop + deltaY

      // 改进边界限制，确保图片不会完全移出裁剪框
      const imageDisplayWidth = this.data.imageWidth * this.data.scale
      const imageDisplayHeight = this.data.imageHeight * this.data.scale

      const minLeft = this.data.cropperWidth - imageDisplayWidth
      const minTop = this.data.cropperHeight - imageDisplayHeight

      newLeft = Math.max(minLeft, Math.min(0, newLeft))
      newTop = Math.max(minTop, Math.min(0, newTop))

      this.setData({
        cropperLeft: newLeft,
        cropperTop: newTop
      })
    } else if (e.touches.length === 2) {
      // 双指缩放
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )

      if (this.data.lastTouchDistance > 0) {
        const scaleChange = distance / this.data.lastTouchDistance
        let newScale = this.startScale * scaleChange

        // 限制缩放范围
        newScale = Math.max(this.data.minScale, Math.min(this.data.maxScale, newScale))

        this.setData({
          scale: newScale,
          lastTouchDistance: distance
        })
      }
    }
  },

  // 图片触摸结束
  onImageTouchEnd() {
    this.setData({
      isScaling: false,
      lastTouchDistance: 0
    })
    this.lastDistance = null
  },

  // 确认裁剪
  onConfirmCrop() {
    wx.showLoading({ title: '裁剪中...' })

    const { imageSrc, cropperWidth, cropperHeight, cropperLeft, cropperTop, scale, imageWidth, imageHeight } = this.data

    console.log('裁剪参数:', {
      imageSrc, cropperWidth, cropperHeight, cropperLeft, cropperTop, scale, imageWidth, imageHeight
    })

    // 使用更高分辨率的canvas进行裁剪，提高图片质量
    const canvasSize = 400 // 使用更高分辨率
    const scaleFactor = canvasSize / cropperWidth

    const ctx = wx.createCanvasContext('cropperCanvas')

    // 清除画布
    ctx.clearRect(0, 0, canvasSize, canvasSize)

    // 设置高质量绘制
    ctx.save()

    // 绘制圆形裁剪区域
    ctx.beginPath()
    ctx.arc(canvasSize/2, canvasSize/2, canvasSize/2, 0, 2*Math.PI)
    ctx.clip()

    // 计算绘制参数，按比例放大到高分辨率canvas
    const drawWidth = imageWidth * scale * scaleFactor
    const drawHeight = imageHeight * scale * scaleFactor
    const drawLeft = cropperLeft * scaleFactor
    const drawTop = cropperTop * scaleFactor

    console.log('高分辨率绘制参数:', {
      drawWidth, drawHeight, drawLeft, drawTop, scaleFactor
    })

    // 绘制图片到canvas
    ctx.drawImage(
      imageSrc,
      0, 0, imageWidth, imageHeight,
      drawLeft, drawTop, drawWidth, drawHeight
    )

    ctx.restore()

    ctx.draw(false, () => {
      // 获取裁剪后的图片
      wx.canvasToTempFilePath({
        canvasId: 'cropperCanvas',
        x: 0,
        y: 0,
        width: canvasSize,
        height: canvasSize,
        destWidth: canvasSize,
        destHeight: canvasSize,
        success: (res) => {
          console.log('裁剪成功:', res.tempFilePath)
          this.uploadCroppedImage(res.tempFilePath)
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('裁剪失败', err)
          wx.showToast({ title: '裁剪失败', icon: 'none' })
        }
      })
    })
  },
  
  // 上传裁剪后的图片
  uploadCroppedImage(tempFilePath) {
    wx.showLoading({ title: '上传中...' })

    wx.cloud.uploadFile({
      cloudPath: 'avatar/' + Date.now() + '.jpg',
      filePath: tempFilePath,
      success: (res) => {
        console.log('文件上传成功:', res.fileID)

        // 调用云函数更新头像
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'updateUserInfo',
            userInfo: {
              avatarUrl: res.fileID,
              updatedAt: new Date()
            }
          },
          success: () => {
            wx.hideLoading()
            console.log('头像更新成功')

            // 通知上一个页面
            const pages = getCurrentPages()
            const prevPage = pages[pages.length - 2]
            if (prevPage && prevPage.onCropComplete) {
              prevPage.onCropComplete(res.fileID)
            }
            wx.navigateBack()
          },
          fail: (err) => {
            wx.hideLoading()
            console.error('更新头像失败', err)
            wx.showToast({ title: '更新头像失败', icon: 'none' })
          }
        })
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('上传裁剪图片失败', err)
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    })
  },

  // 图片点击事件（双击重置）
  onImageTap() {
    const now = Date.now()
    if (this.lastTapTime && now - this.lastTapTime < 300) {
      // 双击重置
      this.resetCrop()
      wx.showToast({
        title: '已重置',
        icon: 'success',
        duration: 1000
      })
    }
    this.lastTapTime = now
  },

  // 重置裁剪
  resetCrop() {
    this.initCropper()
  },

  // 取消裁剪
  onCancelCrop() {
    wx.navigateBack()
  }
})