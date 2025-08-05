const cloud = require('wx-server-sdk') 
cloud.init() 
//引入发送邮件的类库  
var nodemailer = require('nodemailer')
 // 创建一个SMTP客户端配置
var config = {
    host: 'smtp.qq.com', // qq邮箱发送邮件服务器
    port: 465, // qq邮箱发送端口
    secure: true, // 使用SSL
    auth: {
        user: '1022818233@qq.com', //邮箱账号
        pass: ''  //邮箱的授权码
    },
    // 增加超时设置
};
// 创建一个SMTP客户端对象  
var transporter = nodemailer.createTransport(config); 
// 云函数入口函数
exports.main = async(event, context) => {
    try {
        // 获取用户反馈数据
        const { feedbackData } = event;
        console.log('📧 开始发送邮件通知...');
        console.log('反馈数据:', feedbackData);

        // 构建邮件内容
        const emailContent = `
华科羽毛球小程序 - 用户反馈

反馈类型：${feedbackData.type}
用户昵称：${feedbackData.userInfo?.nickName || '匿名用户'}
联系方式：${feedbackData.contact || '未提供'}
提交时间：${new Date(feedbackData.timestamp).toLocaleString('zh-CN')}

反馈内容：
${feedbackData.content}

---
此邮件由华科羽毛球小程序自动发送
请及时处理用户反馈，提升用户体验
        `.trim();

        // 创建一个邮件对象
        var mail = {
            // 发件人（必须与auth.user一致）
            from: '"华科羽毛球小程序" <1022818233@qq.com>',
            // 主题
            subject: `[华科羽毛球小程序] ${feedbackData.type} - ${feedbackData.userInfo?.nickName || '匿名用户'}`,
            // 收件人
            to: '1360294403@qq.com',
            // 邮件内容
            text: emailContent
        };

        console.log('📮 准备发送邮件...');
        console.log('发件人:', mail.from);
        console.log('收件人:', mail.to);
        console.log('主题:', mail.subject);
        console.log('SMTP服务器:', config.host);
        console.log('端口:', config.port);

        // 验证SMTP连接
        console.log('🔗 验证SMTP连接...');
        await transporter.verify();
        console.log('✅ SMTP连接验证成功');

        // 发送邮件
        console.log('📤 开始发送邮件...');
        let res = await transporter.sendMail(mail);

        console.log('✅ 邮件发送成功！');
        console.log('📮 邮件ID:', res.messageId);
        console.log('📧 邮件已发送到:', mail.to);

        return {
            success: true,
            messageId: res.messageId,
            message: '邮件发送成功'
        };

    } catch (error) {
        console.error('❌ 邮件发送失败:', error);
        console.error('错误详情:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });

        // 根据错误类型提供具体的错误信息
        let errorMessage = '邮件发送失败';
        if (error.code === 'EAUTH') {
            errorMessage = '邮箱认证失败，请检查邮箱账号和授权码';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'SMTP服务器连接失败';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = '邮件发送超时';
        }

        return {
            success: false,
            error: error.message,
            errorCode: error.code,
            message: errorMessage
        };
    }
}