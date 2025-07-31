// 云函数：获取用户参加的活动
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const _ = require('lodash');
const db = cloud.database()
const dbCmd = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    console.log('开始查询用户参与的活动，OPENID:', OPENID);
    // 查询用户参与的活动（包含用户ID在participants中的所有活动）
    const result = await db.collection('matches')
      .where({
        'participants._id': OPENID,
        status: dbCmd.in(['active', 'finished'])
      })
      .orderBy('date', 'desc')
      .get()

    console.log('查询成功，返回记录数:', result.data.length);
    console.log('查询到的原始数据:', result.data.length, '条记录')

    // 过滤掉用户作为发布者的活动，只保留用户作为参与者的活动
    const filteredData = result.data.filter(item => {
      // 查找当前用户在participants中的记录
      const userParticipant = item.participants.find(p => p._id === OPENID)

      // 如果找到用户记录，检查isPublisher字段
      if (userParticipant) {
        // 只返回isPublisher为false或者不存在isPublisher字段的记录
        // 这样可以排除用户作为发布者的活动
        return !userParticipant.isPublisher
      }

      // 如果没找到用户记录，说明数据有问题，不返回
      return false
    })

    console.log('过滤后的数据:', filteredData.length, '条记录')

    // 提取所有参与者ID
    const allUserIds = [];
    filteredData.forEach(item => {
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
          }

          userInfos[user._id] = {
            avatarUrl: avatarUrl,
            nickName: nickName,
            gender: user.gender || '',
            birthdate: user.birthdate || '',
            age: calculateAge(user.birthdate) ?? '',
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

    // 合并用户信息到参与者数据中
    const formattedData = filteredData.map(item => {
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
        participants: participantsWithInfo
      };
    });

    // 根据时间判断分离进行中和已结束的活动
    const ongoingList = formattedData.filter(item => !isMatchFinished(item))
    const finishedList = formattedData.filter(item => isMatchFinished(item))

    console.log('进行中活动:', ongoingList.length, '条')
    console.log('已结束活动:', finishedList.length, '条')

    return {
      success: true,
      data: {
        ongoingList,
        finishedList
      }
    }
  } catch (e) {
    console.error('获取参与活动失败详细信息:', e);
    return {
      success: false,
      message: '获取参与活动失败',
      error: e.message,
      stack: e.stack,
      openid: OPENID
    }
  }
}