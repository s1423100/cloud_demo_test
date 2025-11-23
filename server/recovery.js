const express = require('express');
const recovery = express.Router();
const mongoose = require('mongoose');

// 使用已有的 MongoDB 连接
const db = mongoose.connection;

// 定义用户模型 - 添加安全问题字段
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    securityQuestions: {
        favouriteBook: { type: String, required: true },
        bestSubject: { type: String, required: true }
    }
});

const User = mongoose.model('User', userSchema);

// GET 路由 - 显示密码恢复表单
recovery.get('/recovery-form', (req, res) => {
    res.sendFile(path.join(__dirname, '../recovery-form.html'));
});

// GET 路由 - 显示安全问题设置表单
recovery.get('/security-questions-setup', (req, res) => {
    res.sendFile(path.join(__dirname, '../security-setup.html'));
});

// 1. 获取用户的安全问题（不包含答案）
recovery.post('/get-security-questions', async (req, res) => {
    try {
        const { email } = req.body;

        // 验证邮箱是否存在
        if (!email) {
            return res.status(400).json({ 
                error: '邮箱为必填项' 
            });
        }

        // 查找用户
        const user = await User.findOne({ email: email });
        if (!user) {
            // 出于安全考虑，即使邮箱不存在也返回相同消息
            return res.json({
                success: true,
                hasSecurityQuestions: false,
                message: '如果该邮箱已注册，将显示安全问题'
            });
        }

        // 检查用户是否设置了安全问题
        if (!user.securityQuestions || !user.securityQuestions.favouriteBook || !user.securityQuestions.bestSubject) {
            return res.json({
                success: true,
                hasSecurityQuestions: false,
                message: '该账户未设置安全问题，请联系管理员'
            });
        }

        // 返回安全问题（不包含答案）
        res.json({
            success: true,
            hasSecurityQuestions: true,
            questions: {
                question1: '您最喜欢的书是什么？',
                question2: '您最擅长的科目是什么？'
            }
        });

    } catch (error) {
        console.error('获取安全问题错误:', error);
        res.status(500).json({ 
            error: '服务器错误，请稍后重试' 
        });
    }
});

// 2. 验证安全问题答案
recovery.post('/verify-security-answers', async (req, res) => {
    try {
        const { email, favouriteBook, bestSubject } = req.body;

        // 基本验证
        if (!email || !favouriteBook || !bestSubject) {
            return res.status(400).json({ 
                error: '邮箱和安全问题答案均为必填项' 
            });
        }

        // 查找用户
        const user = await User.findOne({ email: email });
        if (!user) {
            // 出于安全考虑，即使邮箱不存在也返回相同消息
            return res.status(400).json({ 
                error: '安全问题答案不正确' 
            });
        }

        // 验证安全问题答案
        const isBookCorrect = user.securityQuestions.favouriteBook.toLowerCase().trim() === favouriteBook.toLowerCase().trim();
        const isSubjectCorrect = user.securityQuestions.bestSubject.toLowerCase().trim() === bestSubject.toLowerCase().trim();

        // 只有当两个问题都答对时才通过验证
        if (isBookCorrect && isSubjectCorrect) {
            res.json({
                success: true,
                message: '身份验证成功，现在可以重置密码',
                verified: true
            });
        } else {
            res.status(400).json({ 
                error: '安全问题答案不正确',
                verified: false
            });
        }

    } catch (error) {
        console.error('验证安全问题错误:', error);
        res.status(500).json({ 
            error: '服务器错误，请稍后重试' 
        });
    }
});

// 3. 更新用户安全问题（在注册或设置中可用）
recovery.post('/update-security-questions', async (req, res) => {
    try {
        const { email, favouriteBook, bestSubject } = req.body;

        // 基本验证
        if (!email || !favouriteBook || !bestSubject) {
            return res.status(400).json({ 
                error: '邮箱和安全问题答案均为必填项' 
            });
        }

        // 使用 MongoDB 原生命令更新安全问题
        const result = await db.collection('users').updateOne(
            // 查询条件：匹配邮箱
            { email: email },
            // 更新操作：设置安全问题答案
            { 
                $set: { 
                    'securityQuestions.favouriteBook': favouriteBook,
                    'securityQuestions.bestSubject': bestSubject,
                    updatedAt: new Date()
                } 
            }
        );

        // 检查是否找到并更新了用户
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                error: '该邮箱未注册' 
            });
        }

        if (result.modifiedCount === 1) {
            res.json({
                success: true,
                message: '安全问题设置成功'
            });
        } else {
            res.status(500).json({ 
                error: '安全问题设置失败' 
            });
        }

    } catch (error) {
        console.error('更新安全问题错误:', error);
        res.status(500).json({ 
            error: '服务器错误，请稍后重试' 
        });
    }
});