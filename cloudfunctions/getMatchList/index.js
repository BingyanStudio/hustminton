// 云函数：获取约球活动列表（带筛选）
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7guleuaib5fb4758' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { page = 1, pageSize = 10, date = '', project = [], location = '', level = '', timeSlot = '' } = event
  const skip = (page - 1) * pageSize

  console.log('云函数接收到的参数:', { page, pageSize, date, project, location, level, timeSlot })

  try {
    // 构建查询条件
    // 获取当前时间
    const now = new Date();
    
    // 构建基础查询条件
    const whereConditions = [];

    // 显示活跃状态的活动或者尚未结束的活动
    // 这里只做基础筛选，具体的时间判断在前端处理
    whereConditions.push(_.or([
      { status: 'active' },
      { date: _.gte(now.toISOString().split('T')[0]) } // 今天及以后的活动
    ]));

    // 日期筛选
    if (date) {
      whereConditions.push({ date: _.gte(date) });
    }

    // 项目筛选 - project字段在数据库中是数组，需要检查数组中是否包含指定项目
    if (project.length > 0) {
      console.log('添加项目筛选:', project);
      // 使用 _.elemMatch 或 _.in 来匹配数组中的元素
      whereConditions.push({
        project: _.elemMatch(_.in(project))
      });
    }

    // 地点筛选
    if (location) {
      console.log('添加地点筛选:', location);
      whereConditions.push({ location: location });
    }

    // 等级筛选
    if (level) {
      console.log('添加等级筛选:', level);
      whereConditions.push({ level: level });
    }

    // 时间段筛选
    if (timeSlot) {
      console.log('添加时间段筛选:', timeSlot);
      whereConditions.push({ timeSlot: timeSlot });
    }

    let query = db.collection('matches')
      .where(_.and(whereConditions))
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
        status: true
      })

    // 获取总数 - 使用相同的筛选条件
    let countQuery = db.collection('matches')
      .where(_.and(whereConditions))

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
            nickname: true,
            gender: true,
            birthdate: true,
            level: true,
            contactType: true,
            contactValue: true
          })
          .get();

        console.log('查询到的用户数据:', userResult.data);

        userResult.data.forEach(user => {
          // 处理头像URL
          const avatarUrl = user.avatarUrl || 'cloud://cloud1-7guleuaib5fb4758.636c-cloud1-7guleuaib5fb4758-1369000957/avatar/默认头像.jpg';
          // 处理昵称
          const nickname = user.nickname || '用户';

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
            nickname: nickname,
            gender: user.gender || '',
            birthdate: user.birthdate || '',
            age: calculateAge(user.birthdate) ?? '',
            level: user.level || '',
            contactType: user.contactType || '',
            contactValue: user.contactValue || ''
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
              nickname: '用户',
              gender: '',
              birthdate: '',
              age: '',
              level: '',
              contactType: '',
              contactValue: ''
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
            nickname: '用户',
            gender: '',
            birthdate: '',
            age: '',
            level: '',
            contactType: '',
            contactValue: ''
          };

          return {
              ...participant,
              avatarUrl: userInfo.avatarUrl,
              nickname: userInfo.nickname,
              gender: userInfo.gender || '',
              birthdate: userInfo.birthdate || '',
              age: userInfo.age || '',
              level: userInfo.level || '',
              contactType: userInfo.contactType || '',
              contactValue: userInfo.contactValue || ''
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