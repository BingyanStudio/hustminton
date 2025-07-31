// 云函数：获取用户发布的活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const _ = require('lodash');
const db = cloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 查询用户发布的活动
    const result = await db.collection('matches')
      .where({ publisher: OPENID })
      .orderBy('createdAt', 'desc')
      .get();

    // 提取所有参与者ID
    const allUserIds = [];
    result.data.forEach(item => {
      // 添加发布者ID
      if (item.publisher && !allUserIds.includes(item.publisher)) {
        allUserIds.push(item.publisher);
      }
      // 添加参与者ID
      if (item.participants && item.participants.length > 0) {
        item.participants.forEach(participant => {
          if (participant._id && !allUserIds.includes(participant._id)) {
            allUserIds.push(participant._id);
          }
        });
      }
    });

    // 查询用户信息
    const userInfos = {};
    if (allUserIds.length > 0) {
      try {
        const userResult = await db.collection('users')
          .where({
            _id: dbCmd.in(allUserIds)
          })
          .field({
            _id: true,
            avatarUrl: true,
            avatar: true,
            avatar_url: true,
            headimgurl: true,
            nickName: true,
            nickname: true,
            name: true,
            gender: true,
            birthdate: true,
            level: true
          })
          .get();

        userResult.data.forEach(user => {
          // 处理头像URL
          const avatarUrl = user.avatarUrl || user.avatar || user.avatar_url || user.headimgurl || 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg';
          // 处理昵称
          const nickName = user.nickName || user.nickname || user.name || '未知用户';

          // 计算年龄
          function calculateAge(birthdate) {
            if (!birthdate) return '';
            try {
              // 处理 "1982-1" 这种格式，补全为 "1982-01-01"
              let dateStr = birthdate;
              if (/^\d{4}-\d{1,2}$/.test(birthdate)) {
                // 如果是 "1982-1" 格式，补全为 "1982-01-01"
                const parts = birthdate.split('-');
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                dateStr = `${year}-${month}-01`;
              }

              const birthYear = new Date(dateStr).getFullYear();
              const currentYear = new Date().getFullYear();
              return currentYear - birthYear;
            } catch (error) {
              console.error('年龄计算失败:', error, 'birthdate:', birthdate);
              return '';
            }
          }

          userInfos[user._id] = {
            avatarUrl: avatarUrl,
            nickName: nickName,
            gender: user.gender || '',
            birthdate: user.birthdate || '',
            age: calculateAge(user.birthdate) || '',
            level: user.level || ''
          };
        });
      } catch (error) {
        console.error('查询用户信息失败:', error);
      }
    }

    // 为没有找到的用户分配默认信息
    allUserIds.forEach(uid => {
      if (!userInfos[uid]) {
        userInfos[uid] = {
            avatarUrl: 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg',
            nickName: '未知用户',
            gender: '',
            birthdate: '',
            age: '',
            level: ''
          };
      }
    });

    // 时间判断工具函数
    function isMatchFinished(matchData) {
      if (!matchData.date || !matchData.timeSlot) {
        return false;
      }

      try {
        // 解析时间段，获取结束时间
        const timeSlotParts = matchData.timeSlot.split('-');
        if (timeSlotParts.length !== 2) {
          return false;
        }

        const endTime = timeSlotParts[1]; // 例如 "10:00"
        const [endHour, endMinute] = endTime.split(':').map(num => parseInt(num));

        // 构建活动结束时间
        const matchEndTime = new Date(matchData.date);
        matchEndTime.setHours(endHour, endMinute, 0, 0);

        // 与当前时间比较
        const now = new Date();
        return now > matchEndTime;
      } catch (error) {
        console.error('判断活动是否结束时出错:', error);
        return false;
      }
    }

    // 合并用户信息到发布者和参与者数据中
    const formattedData = result.data.map(item => {
      // 处理发布者信息
      const publisherInfo = userInfos[item.publisher] || {};
      // 处理参与者信息
      const participantsWithInfo = (item.participants || []).map(participant => {
        const userInfo = userInfos[participant._id] || {};
        return {
            ...participant,
            avatarUrl: userInfo.avatarUrl,
            nickName: userInfo.nickName,
            gender: userInfo.gender,
            birthdate: userInfo.birthdate,
            age: userInfo.age,
            level: userInfo.level
          };
      });

      return {
        ...item,
        publisherInfo: {
          avatarUrl: publisherInfo.avatarUrl,
          nickName: publisherInfo.nickName,
          gender: publisherInfo.gender,
          birthdate: publisherInfo.birthdate,
          age: publisherInfo.age,
          level: publisherInfo.level
        },
        participants: participantsWithInfo
      };
    });

    // 根据时间判断分离进行中和已结束的活动
    const ongoingList = formattedData.filter(item => !isMatchFinished(item));
    const finishedList = formattedData.filter(item => isMatchFinished(item));

    console.log('进行中活动:', ongoingList.length, '条');
    console.log('已结束活动:', finishedList.length, '条');

    return {
      success: true,
      data: {
        ongoingList,
        finishedList
      }
    }
  } catch (e) {
    console.error('获取发布活动失败', e)
    return {
      success: false,
      message: '获取发布活动失败',
      error: e.message
    }
  }
}