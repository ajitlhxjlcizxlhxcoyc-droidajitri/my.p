const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// ==================== PERSISTENT STORAGE ====================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let users = [];
let banners = [];
let messages = [];
let deposits = [];
let withdrawals = [];
let giftCodes = [];
let vipHistory = [];
let bets = [];
let gameResults = [];
let transactions = [];
let pagesConfig = {};

function loadFile(f, def) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f + '.json'), 'utf8')); }
  catch { return def; }
}
function saveFile(f, d) {
  try { fs.writeFileSync(path.join(DATA_DIR, f + '.json'), JSON.stringify(d, null, 2)); }
  catch (e) { console.log('save err:', e.message); }
}

// Load data
users = loadFile('users', []);
banners = loadFile('banners', []);
messages = loadFile('messages', []);
deposits = loadFile('deposits', []);
withdrawals = loadFile('withdrawals', []);
giftCodes = loadFile('giftCodes', []);
vipHistory = loadFile('vipHistory', []);
bets = loadFile('bets', []);
gameResults = loadFile('gameResults', []);
transactions = loadFile('transactions', []);
pagesConfig = loadFile('pages', {});

// Default banners
if (banners.length === 0) {
  banners = [
    { id: Date.now() + '1', imageUrl: 'https://i.ibb.co/hxyMYWyt/file-00000000192c8211bf1bcf496522a496.png', link: '', type: 'popup', isActive: true },
    { id: Date.now() + '2', imageUrl: 'https://i.ibb.co/8DXd4d5D/file-00000000e284820bb3bcdcdc7654f7e9.png', link: '', type: 'home', isActive: true }
  ];
  saveFile('banners', banners);
}

// Default gift codes
if (giftCodes.length === 0) {
  giftCodes = [
    { code: 'DARKWIN600', amount: 600, isUsed: false, usedBy: [], maxUses: 100, usedCount: 0, isActive: true },
    { code: 'WELCOME100', amount: 100, isUsed: false, usedBy: [], maxUses: 100, usedCount: 0, isActive: true }
  ];
  saveFile('giftCodes', giftCodes);
}

// Default pages
if (!pagesConfig.home) {
  pagesConfig = {
    home: { popupBanner: 'https://i.ibb.co/hxyMYWyt/file-00000000192c8211bf1bcf496522a496.png', marqueeText: '🎉 Welcome to DARKWIN! Win big with WinGo', promoText: 'Play. Win. Earn.' },
    deposit: { upiNumber: '7478478039', qrCodeUrl: 'https://i.ibb.co/kVBLF7G6/Screenshot-20260918-145024.png', instructions: 'Scan QR & pay' },
    promotion: { bannerUrl: '', rules: '1. Bonuses credited within 24 hours\n2. Each reward once per day\n3. Fraud forfeits bonuses' },
    agent: { bannerUrl: '', description: 'Invite friends and earn!' }
  };
  saveFile('pages', pagesConfig);
}

// ==================== HELPERS ====================
const genId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const genUID = () => 'DW' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
const genInvite = () => 'DW' + Math.floor(10000 + Math.random() * 90000);

// VIP Config
const vipLevelsConfig = [
  { level: 1, expNeeded: 3000, levelUpBonus: 60, depositBonus: 100, weeklyBonus: 30, monthlyBonus: 80 },
  { level: 2, expNeeded: 30000, levelUpBonus: 180, depositBonus: 300, weeklyBonus: 90, monthlyBonus: 280 },
  { level: 3, expNeeded: 400000, levelUpBonus: 690, depositBonus: 1200, weeklyBonus: 390, monthlyBonus: 980 },
  { level: 4, expNeeded: 1000000, levelUpBonus: 1890, depositBonus: 2500, weeklyBonus: 990, monthlyBonus: 2500 },
  { level: 5, expNeeded: 3000000, levelUpBonus: 4890, depositBonus: 5000, weeklyBonus: 2190, monthlyBonus: 5800 },
  { level: 6, expNeeded: 10000000, levelUpBonus: 16900, depositBonus: 10000, weeklyBonus: 6890, monthlyBonus: 18800 },
  { level: 7, expNeeded: 30000000, levelUpBonus: 58900, depositBonus: 25000, weeklyBonus: 18900, monthlyBonus: 58000 },
  { level: 8, expNeeded: 100000000, levelUpBonus: 169000, depositBonus: 50000, weeklyBonus: 58900, monthlyBonus: 168000 },
  { level: 9, expNeeded: 300000000, levelUpBonus: 689000, depositBonus: 100000, weeklyBonus: 189000, monthlyBonus: 580000 },
  { level: 10, expNeeded: 1000000000, levelUpBonus: 1890000, depositBonus: 250000, weeklyBonus: 589000, monthlyBonus: 1680000 }
];

const findUser = (uid) => users.find(u => u.uid === uid);
const findUserByPhone = (phone) => users.find(u => u.phone === phone);

// Fixed Period Number
function getPeriodNumber(gameMode) {
  const now = new Date();
  const dateBase = String(now.getFullYear()).slice(2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const dur = { wingo30: 30, wingo1: 60, wingo3: 180, wingo5: 300, wingo10: 600 }[gameMode] || 30;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const block = Math.floor((now.getTime() - dayStart) / (dur * 1000));
  return dateBase + String(block).padStart(5, '0');
}

// ==================== AUTH & PROFILE APIs ====================

// Register with ₹58 Bonus
app.post('/api/auth/register', (req, res) => {
  try {
    const { phone, password, referralCode } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone & password required" });
    if (phone.length < 10) return res.status(400).json({ error: "Invalid phone number" });

    const existingUser = findUserByPhone(phone);
    if (existingUser) {
      return res.status(400).json({
        error: "This number is already registered. Please login instead.",
        alreadyRegistered: true
      });
    }

    const newUser = {
      uid: genUID(),
      phone,
      password,
      balance: 58,
      bonusGiven: 58,
      exp: 0,
      vipLevel: 0,
      isBanned: false,
      inviteCode: genInvite(),
      referredBy: referralCode || null,
      totalDeposit: 0,
      totalWithdraw: 0,
      totalBet: 0,
      totalWin: 0,
      totalLoss: 0,
      totalBets: 0,
      winsCount: 0,
      lossCount: 0,
      bankDetails: null,
      upiDetails: null,
      dpUrl: null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    saveFile('users', users);

    transactions.push({
      id: genId('txn_'), uid: newUser.uid, type: 'welcome_bonus', amount: 58,
      status: 'success', details: { reason: 'Welcome to DARKWIN — ₹58 register bonus' },
      date: new Date().toISOString()
    });
    saveFile('transactions', transactions);

    messages.push({
      id: genId('msg_'), uid: newUser.uid,
      title: '🎉 Welcome to DARKWIN!',
      message: 'Your register bonus ₹58 has been credited. Start playing and win big!',
      date: new Date().toISOString()
    });
    saveFile('messages', messages);

    if (referralCode) {
      const ref = users.find(u => u.inviteCode === referralCode);
      if (ref) {
        ref.balance = (ref.balance || 0) + 50;
        saveFile('users', users);
      }
    }

    console.log(`🎉 New user: ${phone} (${newUser.uid}) with ₹58 bonus`);
    res.json({
      message: "Registration successful! ₹58 bonus credited 🎉",
      welcomeBonus: 58,
      user: newUser
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone & password required" });

    const user = findUserByPhone(phone);
    if (!user) return res.status(401).json({ error: "User not found. Please register." });
    if (user.isBanned) return res.status(403).json({ error: "Your account has been banned" });
    if (user.password !== password) return res.status(401).json({ error: "Wrong password" });

    user.lastLogin = new Date().toISOString();
    saveFile('users', users);

    res.json({ message: "Login successful", user });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// User Profile
app.get('/api/user/profile/:uid', (req, res) => {
  const user = findUser(req.params.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Balance + Stats
app.get('/api/user/balance/:uid', (req, res) => {
  const user = findUser(req.params.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    balance: user.balance || 0,
    totalDeposit: user.totalDeposit || 0,
    totalWithdraw: user.totalWithdraw || 0,
    totalBet: user.totalBet || 0,
    totalWin: user.totalWin || 0,
    totalLoss: user.totalLoss || 0,
    totalBets: user.totalBets || 0,
    winsCount: user.winsCount || 0,
    lossCount: user.lossCount || 0,
    vipLevel: user.vipLevel || 0,
    exp: user.exp || 0
  });
});

// Save Bank / UPI / DP
app.post('/api/user/bank', (req, res) => {
  const { uid, accountName, accountNumber, ifsc } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.bankDetails = { accountName, accountNumber, ifsc };
  saveFile('users', users);
  res.json({ message: "Bank saved" });
});

app.post('/api/user/upi', (req, res) => {
  const { uid, upiId, accountName } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.upiDetails = { upiId, accountName };
  saveFile('users', users);
  res.json({ message: "UPI saved" });
});

app.post('/api/user/dp', (req, res) => {
  const { uid, dpUrl } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.dpUrl = dpUrl;
  saveFile('users', users);
  res.json({ message: "DP updated", dpUrl });
});

// ==================== HOME & BANNER APIs ====================

app.post('/api/banner/add', (req, res) => {
  const { imageUrl, link, type } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
  const banner = { id: genId('bn_'), imageUrl, link: link || '', type: type || 'home', isActive: true };
  banners.push(banner);
  saveFile('banners', banners);
  res.json({ message: "Banner added", banner });
});

app.get('/api/banners', (req, res) => {
  res.json(banners.filter(b => b.isActive && b.type === 'home'));
});

app.get('/api/banners/popup', (req, res) => {
  res.json(banners.filter(b => b.isActive && b.type === 'popup'));
});

app.get('/api/admin/banners', (req, res) => res.json(banners));

app.delete('/api/admin/banner/:id', (req, res) => {
  banners = banners.filter(b => b.id !== req.params.id);
  saveFile('banners', banners);
  res.json({ message: "Deleted" });
});

// ==================== WINGO GAME & VIP EXP API ====================

app.post('/api/game/wingo/bet', (req, res) => {
  try {
    const { uid, betAmount, betType, betValue, period, selection } = req.body;
    const user = findUser(uid);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isBanned) return res.status(403).json({ error: "User banned" });
    if (!betAmount || betAmount < 1) return res.status(400).json({ error: "Minimum bet ₹1" });
    if (user.balance < betAmount) return res.status(400).json({ error: "Insufficient balance" });

    const mode = betType || 'wingo30';
    const periodNum = period || getPeriodNumber(mode);

    const now = new Date();
    const dur = { wingo30: 30, wingo1: 60, wingo3: 180, wingo5: 300, wingo10: 600 }[mode] || 30;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const blockStart = Math.floor((now.getTime() - dayStart) / (dur * 1000)) * dur * 1000;
    const remainSec = Math.floor((blockStart + dur * 1000 - (now.getTime() - dayStart)) / 1000);
    if (remainSec < 5) return res.status(400).json({ error: "Betting closed for this period" });

    user.balance -= Number(betAmount);
    user.totalBet = (user.totalBet || 0) + Number(betAmount);
    user.totalBets = (user.totalBets || 0) + 1;
    user.exp = (user.exp || 0) + Number(betAmount);

    vipLevelsConfig.forEach(cfg => {
      if (user.exp >= cfg.expNeeded && user.vipLevel < cfg.level) {
        user.vipLevel = cfg.level;
      }
    });

    saveFile('users', users);

    const bet = {
      id: genId('bet_'),
      uid,
      period: periodNum,
      gameMode: mode,
      betType: selection || betType,
      betValue: betValue !== null && betValue !== undefined ? betValue : null,
      amount: Number(betAmount),
      payout: 0,
      profit: 0,
      result: 'pending',
      resultNumber: null,
      resultColor: null,
      createdAt: new Date().toISOString(),
      settledAt: null
    };
    bets.push(bet);
    saveFile('bets', bets);

    transactions.push({
      id: genId('txn_'), uid, type: 'bet', amount: Number(betAmount),
      status: 'success',
      details: { period: periodNum, gameMode: mode, betType: selection || betType, betValue },
      date: new Date().toISOString()
    });
    saveFile('transactions', transactions);

    vipHistory.push({
      uid, type: "Experience Bonus", expGained: Number(betAmount),
      date: new Date().toISOString()
    });
    saveFile('vipHistory', vipHistory);

    console.log(`🎰 Bet: ${uid} - ${selection || betType} - ₹${betAmount} - Period ${periodNum}`);
    res.json({
      message: "Bet placed successfully",
      betId: bet.id,
      period: periodNum,
      remainingBalance: user.balance,
      currentExp: user.exp,
      vipLevel: user.vipLevel
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/game/wingo/history/:uid', (req, res) => {
  const list = bets
    .filter(b => b.uid === req.params.uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json(list);
});

app.get('/api/game/wingo/periods', (req, res) => {
  const results = gameResults
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  if (results.length === 0) {
    const demo = [];
    for (let i = 0; i < 10; i++) {
      const n = Math.floor(Math.random() * 10);
      const color = n === 0 ? ['violet','red'] : n === 5 ? ['violet','green'] : [1,3,7,9].includes(n) ? ['green'] : ['red'];
      demo.push({ period: getPeriodNumber('wingo30'), number: n, color, gameMode: 'wingo30' });
    }
    return res.json(demo);
  }
  res.json(results);
});

app.get('/api/game/wingo/current-period', (req, res) => {
  const mode = req.query.gameMode || 'wingo30';
  res.json({ period: getPeriodNumber(mode), gameMode: mode, serverTime: new Date().toISOString() });
});

app.get('/api/vip/status/:uid', (req, res) => {
  const user = findUser(req.params.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  const history = vipHistory.filter(h => h.uid === user.uid);
  res.json({
    uid: user.uid,
    exp: user.exp,
    vipLevel: user.vipLevel,
    vipConfig: vipLevelsConfig,
    history
  });
});

// ==================== ADMIN PANEL CONTROL APIs ====================

app.post('/api/admin/give-bonus', (req, res) => {
  const { uid, bonusAmount, reasonMessage } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.balance = (user.balance || 0) + parseFloat(bonusAmount);
  saveFile('users', users);

  messages.push({
    id: genId('msg_'), uid: user.uid,
    title: "Bonus Received!",
    message: reasonMessage || `You have received a bonus of ₹${bonusAmount}!`,
    date: new Date().toISOString()
  });
  saveFile('messages', messages);

  transactions.push({
    id: genId('txn_'), uid, type: 'bonus', amount: parseFloat(bonusAmount),
    status: 'success', details: { reason: reasonMessage },
    date: new Date().toISOString()
  });
  saveFile('transactions', transactions);

  res.json({ message: "Bonus added" });
});

app.post('/api/admin/ban-user', (req, res) => {
  const { uid, banStatus } = req.body;
  const user = findUser(uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.isBanned = banStatus;
  saveFile('users', users);
  res.json({ message: `User ${banStatus ? 'banned' : 'unbanned'}` });
});

app.get('/api/admin/agent-promotion-stats', (req, res) => {
  const stats = users.map(u => ({
    uid: u.uid,
    phone: u.phone,
    totalInvited: users.filter(x => x.referredBy === u.inviteCode).length,
    currentBalance: u.balance
  })).sort((a, b) => b.totalInvited - a.totalInvited);
  res.json(stats);
});

app.get('/api/admin/users', (req, res) => {
  const search = (req.query.search || '').toLowerCase();
  let list = users.slice();
  if (search) list = list.filter(u => u.uid.toLowerCase().includes(search) || u.phone.includes(search));
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/admin/stats', (req, res) => {
  const successDeposits = deposits.filter(d => d.status === 'APPROVED');
  const successWithdraws = withdrawals.filter(w => w.status === 'SUCCESS');
  res.json({
    totalUsers: users.length,
    bannedUsers: users.filter(u => u.isBanned).length,
    activeToday: users.filter(u => u.lastLogin && new Date(u.lastLogin).toDateString() === new Date().toDateString()).length,
    totalBalance: users.reduce((s, u) => s + (u.balance || 0), 0),
    totalDeposit: successDeposits.reduce((s, d) => s + d.amount, 0),
    totalWithdraw: successWithdraws.reduce((s, w) => s + w.amount, 0),
    totalBet: bets.reduce((s, b) => s + b.amount, 0),
    totalPayout: bets.reduce((s, b) => s + (b.payout || 0), 0),
    totalWins: bets.filter(b => b.result === 'win').length,
    totalLosses: bets.filter(b => b.result === 'lose').length,
    pendingDeposits: deposits.filter(d => d.status === 'PENDING').length,
    pendingWithdraws: withdrawals.filter(w => w.status === 'PROCESSING').length
  });
});

app.post('/api/admin/gameresult', (req, res) => {
  try {
    const { period, gameMode, number } = req.body;
    const num = Number(number);

    if (!period || !gameMode || isNaN(num) || num < 0 || num > 9) {
      return res.status(400).json({ error: "period, gameMode and number (0-9) required" });
    }

    if (gameResults.find(r => r.period === period && r.gameMode === gameMode)) {
      return res.status(400).json({ error: "Result already declared for this period" });
    }

    let color;
    if (num === 0) color = ['violet', 'red'];
    else if (num === 5) color = ['violet', 'green'];
    else if ([1,3,7,9].includes(num)) color = ['green'];
    else color = ['red'];

    const record = {
      id: genId('gr_'),
      period,
      gameMode,
      number: num,
      color,
      createdAt: new Date().toISOString()
    };
    gameResults.push(record);
    saveFile('gameResults', gameResults);

    let settledCount = 0, totalPayout = 0, wins = 0, losses = 0;

    bets.forEach(bet => {
      if (bet.period !== period || bet.gameMode !== gameMode || bet.result !== 'pending') return;

      let multiplier = 0;
      const t = (bet.betType || '').toLowerCase();
      const v = (bet.betValue !== null && bet.betValue !== undefined ? bet.betValue.toString() : '').toLowerCase();

      if (t === 'number' || t === 'digit') {
        if (parseInt(v) === num) multiplier = 9;
      } else if (t === 'color') {
        if (color.includes(v)) multiplier = v === 'violet' ? 4.5 : 2;
      } else if (t === 'big') {
        if (num >= 5) multiplier = 2;
      } else if (t === 'small') {
        if (num <= 4) multiplier = 2;
      }

      const payout = multiplier > 0 ? Math.floor(bet.amount * multiplier) : 0;
      bet.result = payout > 0 ? 'win' : 'lose';
      bet.resultNumber = num;
      bet.resultColor = color;
      bet.payout = payout;
      bet.profit = payout > 0 ? (payout - bet.amount) : -bet.amount;
      bet.settledAt = new Date().toISOString();

      const u = findUser(bet.uid);
      if (u) {
        if (payout > 0) {
          u.balance = (u.balance || 0) + payout;
          u.totalWin = (u.totalWin || 0) + payout;
          u.winsCount = (u.winsCount || 0) + 1;
        } else {
          u.totalLoss = (u.totalLoss || 0) + bet.amount;
          u.lossCount = (u.lossCount || 0) + 1;
        }
      }
      if (payout > 0) { totalPayout += payout; wins++; } else losses++;
      settledCount++;
    });

    saveFile('bets', bets);
    saveFile('users', users);

    console.log(`🏆 Result: Period ${period} → ${num} (${color.join('+')}) — ${settledCount} bets settled (${wins}W/${losses}L)`);
    res.json({
      message: `Result ${num} declared`,
      result: record,
      settledBets: settledCount,
      wins,
      losses,
      totalPayout
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/admin/gameresults', (req, res) => {
  res.json(gameResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100));
});

app.get('/api/admin/bets', (req, res) => {
  res.json(bets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200));
});

// ==================== GIFT CODE APIs ====================

app.post('/api/admin/create-giftcode', (req, res) => {
  const { code, amount, maxUses } = req.body;
  if (!code || !amount) return res.status(400).json({ error: "code & amount required" });
  const upper = code.toUpperCase();
  if (giftCodes.find(g => g.code === upper)) return res.status(400).json({ error: "Code exists" });

  giftCodes.push({
    code: upper, amount: parseFloat(amount),
    isUsed: false, usedBy: [],
    maxUses: parseInt(maxUses) || 100, usedCount: 0, isActive: true
  });
  saveFile('giftCodes', giftCodes);
  res.json({ message: "Gift code created" });
});

app.get('/api/admin/giftcodes', (req, res) => res.json(giftCodes));

// ==================== PAGE CONFIG APIs ====================

app.get('/api/pages', (req, res) => res.json(pagesConfig));
app.get('/api/pages/:pageName', (req, res) => res.json(pagesConfig[req.params.pageName] || {}));
app.post('/api/admin/pages/:pageName', (req, res) => {
  pagesConfig[req.params.pageName] = { ...pagesConfig[req.params.pageName], ...req.body };
  saveFile('pages', pagesConfig);
  res.json({ message: "Page updated", page: pagesConfig[req.params.pageName] });
});

// ==================== ROOT ====================
app.get('/', (req, res) => res.json({ success: true, message: '🚀 DARKWIN API running', version: '4.0.0', time: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ==================== INBOX MESSAGES, DEPOSIT & WITHDRAWAL ====================

// User Messages (Inbox)
app.get('/api/user/messages/:uid', (req, res) => {
  const userMsgs = messages.filter(m => m.uid === req.params.uid);
  res.json(userMsgs);
});

// Deposit Money Request
app.post('/api/user/deposit', (req, res) => {
  const { uid, amount } = req.body;
  const dep = { id: Date.now(), uid, amount, status: "APPROVED", date: new Date().toISOString() };
  deposits.push(dep);

  const user = findUser(uid);
  if (user) user.balance += parseFloat(amount);

  res.json({ message: "Deposit successful", deposit: dep });
});

// Deposit History
app.get('/api/user/deposit-history/:uid', (req, res) => {
  res.json(deposits.filter(d => d.uid === req.params.uid));
});

// Withdraw Money Request
app.post('/api/user/withdraw', (req, res) => {
  const { uid, amount } = req.body;
  const user = findUser(uid);

  if (!user || user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });

  user.balance -= parseFloat(amount);
  const wtd = { id: Date.now(), uid, amount, status: "SUCCESS", date: new Date().toISOString() };
  withdrawals.push(wtd);

  res.json({ message: "Withdrawal successful", withdrawal: wtd });
});

// Withdraw History
app.get('/api/user/withdraw-history/:uid', (req, res) => {
  res.json(withdrawals.filter(w => w.uid === req.params.uid));
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
