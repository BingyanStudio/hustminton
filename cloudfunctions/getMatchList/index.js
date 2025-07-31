// 云函数：获取约球活动列表（带筛选）
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { page = 1, pageSize = 10, date = '', project = [] } = event
  const skip = (page - 1) * pageSize

  try {
    // 构建查询条件
    let query = db.collection('matches')
      .where({
        status: 'active',
        date: date ? _.gte(new Date(date).toISOString()) : _.exists(true)
      })
      .orderBy('date', 'asc')
      .skip(skip)
      .limit(pageSize)
      .field({
        _id: true,
        title: true,
        date: true,
        dateText: true,
        timeSlot: true,
        location: true,
        project: true,
        level: true,
        playerCount: true,
        participants: true,
        recruitCount: true,
        description: true,
        contact: true,
        status: true // 添加status字段
      })

    // 如果有项目筛选
    if (project.length > 0) {
      query = query.where({
        project: _.in(project)
      })
    }

    // 获取总数
    let countQuery = db.collection('matches')
      .where({
        status: 'active',
        date: date ? _.gte(new Date(date).toISOString()) : _.exists(true)
      })

    // 如果有项目筛选
    if (project.length > 0) {
      countQuery = countQuery.where({
        project: _.in(project)
      })
    }

    const countResult = await countQuery.count()
    const result = await query.get()

    // 获取所有参与者ID
    const allUserIds = []
    result.data.forEach(item => {
      if (item.participants && item.participants.length > 0) {
        item.participants.forEach(participant => {
          if (participant._id && !allUserIds.includes(participant._id)) {
            allUserIds.push(participant._id)
          }
        })
      }
    })

    // 查询用户信息获取头像和昵称
    const userInfos = {};
    if (allUserIds.length > 0) {
      try {
        const userResult = await db.collection('users')
          .where({
            _id: _.in(allUserIds)
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

        console.log('查询到的用户数据:', userResult.data);

        userResult.data.forEach(user => {
          // 处理头像URL
          const avatarUrl = user.avatarUrl || user.avatar || user.avatar_url || user.headimgurl || 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg';
          // 处理昵称
          const nickName = user.nickName || user.nickname || user.name || '用户';

          // 计算年龄
          function calculateAge(birthdate) {
            if (!birthdate) return '';
            try {
              let birthYear, birthMonth = 1; // 默认月份为1月
              
              // 解析出生年月
              if (/^\d{4}$/.test(birthdate)) {
                // 仅年份格式 (YYYY)
                birthYear = parseInt(birthdate);
              } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(birthdate)) {
                // YYYY-MM-DD 格式
                const parts = birthdate.split('-');
                birthYear = parseInt(parts[0]);
                birthMonth = parseInt(parts[1]);
              } else if (/^\d{4}-\d{1,2}$/.test(birthdate)) {
                // YYYY-M 或 YYYY-MM 格式
                const parts = birthdate.split('-');
                birthYear = parseInt(parts[0]);
                birthMonth = parseInt(parts[1]);
              } else {
                return ''; // 格式无效
              }
              
              // 获取当前年月
              const now = new Date();
              const currentYear = now.getFullYear();
              const currentMonth = now.getMonth() + 1; // 月份从0开始，需+1
              
              // 计算年龄
              let age = currentYear - birthYear;
              
              // 如果当前月份小于出生月份，年龄减1
              if (currentMonth < birthMonth) {
                age -= 1;
              }
              
              return age >= 0 ? age.toString() : '0';
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
              nickName: '用户',
              gender: '',
              birthdate: '',
              age: '',
              level: ''
            };
          }
        });

    // 额外日志：输出获取到的用户信息
    console.log('用户信息:', userInfos);

    // 格式化数据（不在云函数层面过滤时间，让前端处理）
    const formattedData = result.data.map(item => {
      // 确保playerCount是数字
      const numPlayerCount = parseInt(item.playerCount) || 0
      // 使用数据库中存储的recruitCount值
      const recruitCount = parseInt(item.recruitCount) || 0

      // 补充参与者头像和昵称信息
      const participantsWithAvatar = item.participants.map(participant => {
        const userInfo = userInfos[participant._id] || {
          avatarUrl: 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg',
          nickName: '用户',
          gender: '',
          birthdate: '',
          age: '',
          level: ''
        };

        return {
            ...participant,
            avatarUrl: participant.avatarUrl || userInfo.avatarUrl,
            nickName: participant.nickName || userInfo.nickName,
            gender: participant.gender || userInfo.gender || '',
            birthdate: participant.birthdate || userInfo.birthdate || '',
            age: participant.age || userInfo.age || '',
            level: participant.level || userInfo.level || ''
          };
      });

      return {
        ...item,
        playerCount: numPlayerCount,
        recruitCount,
        participants: participantsWithAvatar
      };
    });

    return {
      success: true,
      data: {
        list: formattedData,
        total: countResult.total,
        hasMore: skip + formattedData.length < countResult.total
      }
    }
  } catch (e) {
    console.error('获取活动列表失败', e)
    return {
      success: false,
      message: '获取活动列表失败',
      error: e.message
    }
  }
}