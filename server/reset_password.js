const express = require('express');
const bcrypt = require('bcrypt');
const reset_password = express.Router();
const mongoose = require('mongoose');

// 使用已有的 MongoDB 连接
const db = mongoose.connection;

// 密码重置路由
reset_password.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword, token } = req.body;

        // 基本验证
        if (!email || !newPassword) {
            return res.status(400).json({ 
                error: '邮箱和新密码均为必填项' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: '密码长度至少6位' 
            });
        }

        // 加密新密码
        //if not using this than need change everything in this page
        //also the login_action.js
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 使用 MongoDB 原生命令更新密码
        const result = await db.collection('users').updateOne(
            // 查询条件：匹配邮箱
            { email: email },
            // 更新操作：设置新密码
            { 
                $set: { 
                    password: hashedPassword,
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
                message: '密码重置成功，请使用新密码登录'
            });
        } else {
            res.status(500).json({ 
                error: '密码更新失败' 
            });
        }

    } catch (error) {
        console.error('重置密码错误:', error);
        res.status(500).json({ 
            error: '服务器错误，请稍后重试' 
        });
    }
});

module.exports = reset_password;