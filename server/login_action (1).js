const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const login = express.Router();  // ✅ 修正拼写
const mongoose = require('mongoose');

// 连接 MongoDB
mongoose.connect('mongodb://localhost:27017/eat_around', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// 定义用户模型 - 添加 email 字段
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },  // ✅ 添加 email
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// 1. 用户登录 - 对应 login.html
login.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // ✅ 使用 MongoDB 查询用户
        const user = await User.findOne({ username: username });
        
        // 检查用户是否存在且密码是否正确
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成 JWT token，包含用户ID，使用固定密钥，24小时过期
        const token = jwt.sign({ userId: user._id }, 'secret', { expiresIn: '24h' });  // ✅ 使用 _id
        
        // 返回成功的 JSON 响应
        res.json({
            success: true, // 操作成功标志
            message: '登录成功', // 成功消息
            token, // JWT token
            user: { id: user._id, username: user.username } // ✅ 使用 _id
        });
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

// 2. 用户注册 - 对应 register.html
login.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // ✅ 使用 MongoDB 检查用户名是否已存在
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 使用 bcrypt 加密密码，10 是 salt 轮数
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // ✅ 创建新用户对象并保存到 MongoDB
        const newUser = new User({
            username: username,
            email: email,
            password: hashedPassword
        });
        
        await newUser.save();
        
        // 返回 201 创建成功状态码和响应
        res.status(201).json({
            success: true, // 操作成功标志
            message: '注册成功', // 成功消息
            user: { id: newUser._id, username: newUser.username } // ✅ 使用 _id
        });
    } catch (error) {
        res.status(500).json({ error: '注册失败' });
    }
});

// 3. 获取用户资料 - 对应 profile.html
login.get('/profile', authenticateToken, async (req, res) => {
    try {
        // ✅ 使用 MongoDB 查询用户
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 返回用户资料的 JSON 响应
        res.json({
            success: true, // 操作成功标志
            user: { // 用户信息
                id: user._id, // ✅ 使用 _id
                username: user.username, // 用户名
                email: user.email // 邮箱
            }
        });
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

// 4. 更新用户资料 - 对应 profile.html
login.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        
        // ✅ 使用 MongoDB 更新用户邮箱
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { email: email },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 返回成功的 JSON 响应
        res.json({
            success: true, // 操作成功标志
            message: '资料更新成功' // 成功消息
        });
    } catch (error) {
        res.status(500).json({ error: '更新失败' });
    }
});

// 认证中间件函数
// 验证 JWT token 的中间件
function authenticateToken(req, res, next) {
    // 从请求头获取 authorization 字段
    const authHeader = req.headers['authorization'];
    // 提取 token（格式：Bearer <token>）
    const token = authHeader && authHeader.split(' ')[1];
    
    // 检查 token 是否存在
    if (!token) {
        // 返回 401 未授权状态码和错误信息
        return res.status(401).json({ error: '需要认证令牌' });
    }
    
    // 验证 token 的有效性
    jwt.verify(token, 'secret', (err, user) => {
        // 如果验证出错，返回 403 禁止访问状态码
        if (err) return res.status(403).json({ error: '令牌无效' });
        // 将用户信息添加到请求对象中
        req.user = user;
        // 调用下一个中间件或路由处理函数
        next();
    });
}

// 导出路由对象，供其他模块使用
module.exports = login;