require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://CAndrew:1103Andrew@eataround.hkhcddu.mongodb.net/?appName=eataround';
const MONGO_DB = 'shop';
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-strong-secret';

mongoose.set('strictQuery', true);
mongoose
  .connect(MONGO_URI, { dbName: MONGO_DB })
  .then(() => console.log(`Connected to MongoDB database "${MONGO_DB}"`))
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exitCode = 1;
  });

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true }, // legacy field support
    email: { type: String, unique: true, trim: true }, // optional for legacy docs
    passwordHash: { type: String }, // hashed password for new flow
    password: { type: String }, // legacy password (hashed or plain)
    book: { type: String, default: '' }, // legacy favourite book
    subject: { type: String, default: '' }, // legacy best subject
    securityQuestions: {
      favouriteBook: { type: String, default: '' },
      bestSubject: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    code: { type: String, index: true, unique: true, sparse: true },
    shopLocation: { type: String, default: '' },
    customerNotes: { type: String, default: '' },
    orderedAt: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    items: { type: [orderItemSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.virtual('total').get(function total() {
  return (this.items || []).reduce((sum, item) => sum + item.quantity * item.price, 0);
});

// Use the legacy collection name "user" so this server hits the same data as the other instance.
const User = mongoose.model('User', userSchema, 'user');
const Order = mongoose.model('Order', orderSchema);
const Food =
  mongoose.models.Food ||
  mongoose.model(
    'Food',
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        category: { type: String, default: '' },
        description: { type: String, default: '' },
      },
      { timestamps: true }
    ),
    'food'
  );

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to login page for convenience
app.get('/', (_req, res) => {
  res.redirect('/html/login.html');
});

function buildToken(user, purpose = 'auth', expiresIn = '24h') {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username, purpose },
    JWT_SECRET,
    { expiresIn }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== 'auth') {
      return res.status(401).json({ error: 'Invalid token purpose' });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, name, email, password, favouriteBook, bestSubject } = req.body;
    const finalUsername = username || name;
    if (!finalUsername || !password) {
      return res.status(400).json({ error: 'Username/name and password are required' });
    }
    const existing = await User.findOne({
      $or: [{ username: finalUsername }, { name: finalUsername }, { email }],
    });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: finalUsername,
      name: name || finalUsername,
      email: email || '',
      passwordHash,
      password: passwordHash, // keep legacy field populated
      securityQuestions: {
        favouriteBook: favouriteBook || '',
        bestSubject: bestSubject || '',
      },
    });
    const token = buildToken(user);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ error: 'Unable to register right now' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, name, password } = req.body;
    const loginName = username || name;
    if (!loginName || !password) {
      return res.status(400).json({ error: 'Username/name and password are required' });
    }
    const user = await User.findOne({
      $or: [{ username: loginName }, { name: loginName }],
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!user.username && user.name) {
      user.username = user.name; // normalize legacy docs for token payload/response
    }
    const stored = user.passwordHash || user.password || '';
    const ok = stored?.startsWith('$2')
      ? await bcrypt.compare(password, stored)
      : stored === password;
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = buildToken(user);
    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Unable to login right now' });
  }
});

// Legacy login to match the other server.js (expects { name, password } and returns user only).
app.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'name and password are required' });
    }
    const user = await User.findOne({
      $or: [{ name }, { username: name }],
    }).lean();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const stored = user.passwordHash || user.password || '';
    const isHashed = stored.startsWith('$2');
    const match = isHashed ? await bcrypt.compare(password, stored) : stored === password;
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, user: { id: user._id, name: user.name || user.username } });
  } catch (err) {
    console.error('Legacy login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy register to mirror the other server.js (creates name/password only).
app.post('/register', async (req, res) => {
  try {
    const { name, password, book = '', subject = '' } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'name and password are required' });
    }
    const exists = await User.findOne({ $or: [{ name }, { username: name }] });
    if (exists) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username: name,
      passwordHash: hashed,
      // keep legacy field populated for compatibility
      password: hashed,
      book,
      subject,
    });
    res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name || user.username, book, subject },
    });
  } catch (err) {
    console.error('Legacy register error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    success: true,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      securityQuestionsSet: Boolean(
        user.securityQuestions?.favouriteBook && user.securityQuestions?.bestSubject
      ),
    },
  });
});

app.post('/api/recovery/verify', async (req, res) => {
  try {
    const { username, name, email, favouriteBook, bestSubject } = req.body;
    if (!username && !name && !email) {
      return res.status(400).json({ error: 'Username/name or email is required' });
    }
    const lookup = username || name || '';
    const user = await User.findOne({
      $or: [{ username: lookup }, { name: lookup }, { email: email || '' }],
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const storedFavourite =
      (user.securityQuestions?.favouriteBook || user.book || '').toLowerCase().trim();
    const storedBest =
      (user.securityQuestions?.bestSubject || user.subject || '').toLowerCase().trim();
    const answersMatch =
      storedFavourite === (favouriteBook || '').toLowerCase().trim() &&
      storedBest === (bestSubject || '').toLowerCase().trim();
    if (!answersMatch) {
      return res.status(400).json({ error: 'Security answers do not match' });
    }
    const resetToken = buildToken(user, 'password-reset', '15m');
    res.json({ success: true, resetToken });
  } catch (err) {
    console.error('Recovery verify error', err);
    res.status(500).json({ error: 'Unable to verify answers right now' });
  }
});

app.put('/api/recovery/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Wrong token type' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await User.findByIdAndUpdate(payload.sub, {
      passwordHash,
      password: passwordHash, // keep legacy field in sync
    });
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Password reset error', err);
    res.status(400).json({ error: 'Reset token is invalid or expired' });
  }
});

app.post('/api/recovery/security', requireAuth, async (req, res) => {
  try {
    const { favouriteBook, bestSubject } = req.body;
    await User.findByIdAndUpdate(req.userId, {
      securityQuestions: { favouriteBook: favouriteBook || '', bestSubject: bestSubject || '' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Update security questions error', err);
    res.status(500).json({ error: 'Unable to update security questions' });
  }
});

// Orders summary (no auth per current flow)
app.get('/api/orders/summary', async (_req, res) => {
  try {
    const orders = await Order.find({}).lean();
    const withTotals = orders.map((o) => ({
      id: o._id,
      code: o.code,
      items: o.items || [],
      total: (o.items || []).reduce((sum, item) => sum + item.quantity * item.price, 0),
    }));
    const totalSum = withTotals.reduce((sum, o) => sum + (o.total || 0), 0);
    res.json({ success: true, orders: withTotals, totalSum });
  } catch (err) {
    console.error('Order summary error', err);
    res.status(500).json({ error: 'Unable to load order summary' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order =
      (await Order.findOne({ code: id }).lean()) ||
      (mongoose.isValidObjectId(id) ? await Order.findById(id).lean() : null);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const total = (order.items || []).reduce((sum, item) => sum + item.quantity * item.price, 0);
    res.json({ success: true, order: { ...order, total } });
  } catch (err) {
    console.error('Get order error', err);
    res.status(500).json({ error: 'Unable to load order' });
  }
});

function generateOrderCode() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// Create an order (cart checkout) - requires auth to track user
app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { items = [], shopLocation = '', customerNotes = '' } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    const sanitizedItems = items
      .map((item) => ({
        name: String(item.name || '').trim(),
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
      }))
      .filter((i) => i.name);
    if (!sanitizedItems.length) {
      return res.status(400).json({ error: 'Items missing names' });
    }
    const order = await Order.create({
      code: generateOrderCode(),
      shopLocation,
      customerNotes,
      items: sanitizedItems,
      orderedAt: new Date(),
      user: req.userId,
    });
    res.status(201).json({ success: true, orderId: order._id, code: order.code });
  } catch (err) {
    console.error('Create order error', err);
    res.status(500).json({ error: 'Unable to create order' });
  }
});

// Delete all orders (no auth per current flow)
app.delete('/api/orders', async (_req, res) => {
  try {
    const result = await Order.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (err) {
    console.error('Delete orders error', err);
    res.status(500).json({ error: 'Unable to delete orders' });
  }
});

// Simple food listing from collection "food" in DB "shop".
app.get('/api/foods', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const foods = await Food.find(filter).lean();
    res.json({ success: true, foods });
  } catch (err) {
    console.error('Get foods error', err);
    res.status(500).json({ error: 'Unable to load foods' });
  }
});

// Get orders (all orders; no auth required per request)
app.get('/api/orders/mine', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ orderedAt: -1 }).lean();
    const withTotals = orders.map((o) => ({
      ...o,
      total: (o.items || []).reduce((sum, item) => sum + item.quantity * item.price, 0),
    }));
    const totalSum = withTotals.reduce((sum, o) => sum + (o.total || 0), 0);
    res.json({ success: true, orders: withTotals, totalSum });
  } catch (err) {
    console.error('List orders error', err);
    res.status(500).json({ error: 'Unable to load your orders' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
