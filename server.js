// ============================================================
//  DARKWIN — Complete Backend API
//  WinGo Game + Full Tracking + Permanent Users
// ============================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== STORAGE ====================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const loadData = (f) => {
  const p = path.join(DATA_DIR, f + '.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
};
const saveData = (f, d) => {
  try { fs.writeFileSync(path.join(DATA_DIR, f + '.json'), JSON.stringify(d, null, 2)); }
  catch (e) { console.log('save error:', e.message); }
};

const genId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const genUID = () => 'DW' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
const genInvite = () => 'DW' + Math.floor(10000 + Math.random() * 90000);

// ==================== INIT DATA ====================
function initData() {
  ['users','transactions','bets','giftcodes','gameresults','messages','banners','withdrawals','deposits']
    .forEach(f => {
      if (!fs.existsSync(path.join(DATA_DIR, f + '.json'))) saveData(f, []);
    });

  if (loadData('banners').length === 0) {
    saveData('banners', [
      { id: genId('bn_'), title: 'Welcome', imageUrl: 'https://i.ibb.co/hxyMYWyt/file-00000000192c8211bf1bcf496522a496.png', type: 'popup', position: 0, isActive: true, createdAt: new Date().toISOString() },
      { id: genId('bn_'), title: 'Home', imageUrl: 'https://i.ibb.co/8DXd4d5D/file-00000000e284820bb3bcdcdc7654f7e9.png', type: 'home', position: 0, isActive: true, createdAt: new Date().toISOString() }
    ]);
  }
  if (loadData('giftcodes').length === 0) {
    saveData('giftcodes', [
      { id: genId('gc_'), code: 'DARKWIN600', amount: 600, maxUses: 100, usedCount: 0, usedBy: [], isActive: true, createdAt: new Date().toISOString() },
      { id: genId('gc_'), code: 'WELCOME100', amount: 100, maxUses: 100, usedCount: 0, usedBy: [], isActive: true, createdAt: new Date().toISOString() }
    ]);
  }
  console.log('✅ Data ready in', DATA_DIR);
}
initData();

// ==================== WINGO PERIOD GENERATOR (FIXED) ====================
// Period = YYMMDDHHmmss-based, blocks of 30s/1m/3m/5m/10m
// Ek period ka number same rehta hai jab tak period khatam na ho
function getPeriodNumber(gameMode) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateBase = yy + mm + dd;

  // Seconds ka block (30s = 2 blocks/min, 1m = 1 block/min, etc.)
  const durations = { wingo30: 30, wingo1: 60, wingo3: 180, wingo5: 300, wingo10: 600 };
  const dur = durations[gameMode] || 30;

  // Day-start se block index count
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msElapsed = now.getTime() - dayStart;
  const blockIndex = Math.floor(msElapsed / (dur * 1000));

  // Fixed 5-digit block number
  const blockStr = String(blockIndex).padStart(5, '0');
  return dateBase + blockStr;
}

// ==================== HELPERS ====================
const findUser = (uid) => loadData('users').find(u => u.uid === uid);
const findUserByPhone = (phone) => loadData('users').find(u => u.phone === phone);
const updateUser = (uid, updates) => {
  const users = loadData('users');
  const i = users.findIndex(u => u.uid === uid);
  if (i === -1) return null;
  users[i] = { ...users[i], ...updates };
  saveData('users', users);
  return users[i];
};

// ==================== ROOT ====================
app.get('/', (req, res) => res.json({ success: true, message: '🚀 DARKWIN API running', version: '4.0.0', time: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ==================== AUTH ====================
app.post('/api/auth/register', (req, res) => {
  try {
    const { phone, password, referralCode } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });
    if (phone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

    // ✅ PERMANENT CHECK — agar phone already registered hai
    const existing = findUserByPhone(phone);
    if (existing) {
      return res.status(400).json({
        error: 'This number is already registered. Please login instead.',
        alreadyRegistered: true
      });
    }

    const users = loadData('users');
    const newUser = {
      uid: genUID(),
      phone,
      password, // plain (production mein hash karo)
      balance: 58, // 🎁 ₹58 WELCOME BONUS
      bonusGiven: 58,
      exp: 0,
      vipLevel: 0,
      totalDeposit: 0,
      totalWithdraw: 0,
      totalBet: 0,
      totalWin: 0,
      totalLoss: 0,
      totalBets: 0,
      winsCount: 0,
      lossCount: 0,
      isBanned: false,
      inviteCode: genInvite(),
      referredBy: referralCode || null,
      bankDetails: null,
      upiDetails: null,
      dpUrl: null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    users.push(newUser);
    saveData('users', users);

    // Transaction log for welcome bonus
    const txns = loadData('transactions');
    txns.push({
      id: genId('txn_'),
      uid: newUser.uid,
      type: 'welcome_bonus',
      amount: 58,
      status: 'success',
      details: { reason: 'Welcome to DARKWIN — ₹58 register bonus' },
      createdAt: new Date().toISOString()
    });
    saveData('transactions', txns);

    // Welcome message
    const messages = loadData('messages');
    messages.push({
      id: genId('msg_'),
      uid: newUser.uid,
      title: '🎉 Welcome to DARKWIN!',
      message: 'Your register bonus ₹58 has been credited to your wallet. Start playing and win big!',
      date: new Date().toISOString()
    });
    saveData('messages', messages);

    // Referral bonus
    if (referralCode) {
      const ref = users.find(u => u.inviteCode === referralCode);
      if (ref) {
        updateUser(ref.uid, { balance: (ref.balance || 0) + 50 });
        const t2 = loadData('transactions');
        t2.push({
          id: genId('txn_'), uid: ref.uid, type: 'referral_bonus', amount: 50,
          status: 'success', details: { referred: phone }, createdAt: new Date().toISOString()
        });
        saveData('transactions', t2);
      }
    }

    console.log(`🎉 New user registered: ${phone} (UID: ${newUser.uid}) with ₹58 bonus`);
    res.json({
      message: 'Registration successful! ₹58 bonus credited 🎉',
      welcomeBonus: 58,
      user: newUser
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone & password required' });

    const user = findUserByPhone(phone);
    if (!user) return res.status(401).json({ error: 'User not found. Please register.' });
    if (user.isBanned) return res.status(403).json({ error: 'Your account has been banned' });
    if (user.password !== password) return res.status(401).json({ error: 'Wrong password' });

    updateUser(user.uid, { lastLogin: new Date().toISOString() });
    res.json({ message: 'Login successful', user });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER ====================
app.get('/api/user/profile/:uid', (req, res) => {
  const u = findUser(req.params.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

app.get('/api/user/balance/:uid', (req, res) => {
  const u = findUser(req.params.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: u.balance || 0,
    totalDeposit: u.totalDeposit || 0,
    totalWithdraw: u.totalWithdraw || 0,
    totalBet: u.totalBet || 0,
    totalWin: u.totalWin || 0,
    totalLoss: u.totalLoss || 0,
    totalBets: u.totalBets || 0,
    winsCount: u.winsCount || 0,
    lossCount: u.lossCount || 0,
    vipLevel: u.vipLevel || 0,
    exp: u.exp || 0
  });
});

app.post('/api/user/bank', (req, res) => {
  const { uid, accountName, accountNumber, ifsc } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  const u = updateUser(uid, { bankDetails: { accountName, accountNumber, ifsc } });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'Bank saved', bank: u.bankDetails });
});

app.post('/api/user/upi', (req, res) => {
  const { uid, upiId, accountName } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  const u = updateUser(uid, { upiDetails: { upiId, accountName } });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'UPI saved', upi: u.upiDetails });
});

app.post('/api/user/dp', (req, res) => {
  const { uid, dpUrl } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  const u = updateUser(uid, { dpUrl });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'Profile picture updated', dpUrl });
});

// ==================== 🎰 WINGO GAME (FULL TRACKING) ====================

// Place Bet — Full tracking
app.post('/api/game/wingo/bet', (req, res) => {
  try {
    const { uid, betAmount, betType, betValue, period, selection } = req.body;

    if (!uid) return res.status(400).json({ error: 'UID required' });
    if (!betAmount || betAmount < 1) return res.status(400).json({ error: 'Minimum bet ₹1' });
    if (!betType) return res.status(400).json({ error: 'Bet type required' });

    const user = findUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance' });

    // Auto-generate period if missing (FIXED — same number across users in same time block)
    const periodNum = period || getPeriodNumber(betType);

    // Check if betting is closed (last 5 seconds)
    const now = new Date();
    const durations = { wingo30: 30, wingo1: 60, wingo3: 180, wingo5: 300, wingo10: 600 };
    const dur = durations[betType] || 30;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msElapsed = now.getTime() - dayStart;
    const blockStart = Math.floor(msElapsed / (dur * 1000)) * dur * 1000;
    const remainSec = Math.floor((blockStart + dur * 1000 - msElapsed) / 1000);
    if (remainSec < 5) return res.status(400).json({ error: 'Betting closed for this period' });

    // Deduct balance
    const users = loadData('users');
    const uIdx = users.findIndex(u => u.uid === uid);
    users[uIdx].balance -= Number(betAmount);
    users[uIdx].totalBet = (users[uIdx].totalBet || 0) + Number(betAmount);
    users[uIdx].totalBets = (users[uIdx].totalBets || 0) + 1;
    users[uIdx].exp = (users[uIdx].exp || 0) + Number(betAmount);
    // VIP level up
    const vipReqs = [3000, 30000, 400000, 1000000, 3000000, 10000000, 30000000, 100000000, 300000000, 1000000000];
    let newVip = users[uIdx].vipLevel || 0;
    vipReqs.forEach((req, idx) => { if (users[uIdx].exp >= req && newVip < idx + 1) newVip = idx + 1; });
    users[uIdx].vipLevel = newVip;
    saveData('users', users);

    // Save bet with full tracking
    const bets = loadData('bets');
    const bet = {
      id: genId('bet_'),
      uid,
      period: periodNum,
      gameMode: betType,
      betType: selection || betType,   // "big"/"small"/"color"/"number"
      betValue: betValue !== null && betValue !== undefined ? betValue : null,
      amount: Number(betAmount),
      payout: 0,
      profit: 0,          // positive if win, negative if lose
      result: 'pending',  // pending / win / lose
      resultNumber: null,
      resultColor: null,
      createdAt: new Date().toISOString(),
      settledAt: null
    };
    bets.push(bet);
    saveData('bets', bets);

    // Transaction log
    const txns = loadData('transactions');
    txns.push({
      id: genId('txn_'),
      uid,
      type: 'bet',
      amount: Number(betAmount),
      status: 'success',
      details: { period: periodNum, gameMode: betType, betType: selection || betType, betValue },
      createdAt: new Date().toISOString()
    });
    saveData('transactions', txns);

    console.log(`🎰 Bet placed: ${uid} - ${selection || betType} - ₹${betAmount} - Period ${periodNum}`);

    res.json({
      message: 'Bet placed successfully',
      betId: bet.id,
      period: periodNum,
      newBalance: users[uIdx].balance,
      currentExp: users[uIdx].exp,
      vipLevel: users[uIdx].vipLevel
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user bet history with full tracking
app.get('/api/game/wingo/history/:uid', (req, res) => {
  const list = loadData('bets')
    .filter(b => b.uid === req.params.uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  res.json(list);
});

// Get recent game results (periods)
app.get('/api/game/wingo/periods', (req, res) => {
  const results = loadData('gameresults')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  if (results.length === 0) {
    // Generate demo results with FIXED period format
    const demo = [];
    for (let i = 0; i < 10; i++) {
      const n = Math.floor(Math.random() * 10);
      const color = n === 0 ? ['violet','red'] : n === 5 ? ['violet','green'] : [1,3,7,9].includes(n) ? ['green'] : ['red'];
      const periodNum = getPeriodNumber('wingo30');
      demo.push({
        period: periodNum.slice(0, -1) + (parseInt(periodNum.slice(-1)) - i),
        number: n,
        color,
        gameMode: 'wingo30'
      });
    }
    return res.json(demo);
  }
  res.json(results);
});

// Get current period (for frontend sync)
app.get('/api/game/wingo/current-period', (req, res) => {
  const { gameMode = 'wingo30' } = req.query;
  res.json({
    period: getPeriodNumber(gameMode),
    gameMode,
    serverTime: new Date().toISOString()
  });
});

// ==================== RESULTS (Admin declares) ====================
app.post('/api/admin/gameresult', (req, res) => {
  try {
    const { period, gameMode, number } = req.body;
    const num = Number(number);

    if (!period || !gameMode || isNaN(num) || num < 0 || num > 9) {
      return res.status(400).json({ error: 'period, gameMode and number (0-9) required' });
    }

    const results = loadData('gameresults');
    if (results.find(r => r.period === period && r.gameMode === gameMode)) {
      return res.status(400).json({ error: 'Result already declared for this period' });
    }

    // Color logic
    let color;
    if (num === 0) color = ['violet','red'];
    else if (num === 5) color = ['violet','green'];
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
    results.push(record);
    saveData('gameresults', results);

    // Settle all pending bets for this period
    const bets = loadData('bets');
    const users = loadData('users');
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

      if (payout > 0) {
        const ui = users.findIndex(u => u.uid === bet.uid);
        if (ui !== -1) {
          users[ui].balance = (users[ui].balance || 0) + payout;
          users[ui].totalWin = (users[ui].totalWin || 0) + payout;
          users[ui].winsCount = (users[ui].winsCount || 0) + 1;
        }
        totalPayout += payout;
        wins++;
      } else {
        const ui = users.findIndex(u => u.uid === bet.uid);
        if (ui !== -1) {
          users[ui].totalLoss = (users[ui].totalLoss || 0) + bet.amount;
          users[ui].lossCount = (users[ui].lossCount || 0) + 1;
        }
        losses++;
      }
      settledCount++;
    });

    saveData('bets', bets);
    saveData('users', users);

    console.log(`🏆 Result declared: Period ${period} → Number ${num} (${color.join('+')}) — ${settledCount} bets settled`);

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
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MESSAGES ====================
app.get('/api/user/messages/:uid', (req, res) => {
  const list = loadData('messages')
    .filter(m => m.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(list);
});

// ==================== GIFT CODE ====================
app.post('/api/user/claim-giftcode', (req, res) => {
  try {
    const { uid, code } = req.body;
    if (!uid || !code) return res.status(400).json({ error: 'UID & code required' });

    const user = findUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const gifts = loadData('giftcodes');
    const gi = gifts.findIndex(g => g.code === code.toUpperCase() && g.isActive);
    if (gi === -1) return res.status(400).json({ error: 'Invalid Gift Code' });
    if (gifts[gi].usedCount >= gifts[gi].maxUses) return res.status(400).json({ error: 'Code Expired' });
    if (gifts[gi].usedBy.includes(uid)) return res.status(400).json({ error: 'Already used this code' });

    const users = loadData('users');
    const ui = users.findIndex(u => u.uid === uid);
    users[ui].balance = (users[ui].balance || 0) + gifts[gi].amount;
    saveData('users', users);

    gifts[gi].usedCount++;
    gifts[gi].usedBy.push(uid);
    saveData('giftcodes', gifts);

    const txns = loadData('transactions');
    txns.push({
      id: genId('txn_'), uid, type: 'gift', amount: gifts[gi].amount,
      status: 'success', details: { code: gifts[gi].code },
      createdAt: new Date().toISOString()
    });
    saveData('transactions', txns);

    res.json({
      message: `Received ₹${gifts[gi].amount}!`,
      amount: gifts[gi].amount,
      newBalance: users[ui].balance
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DEPOSIT ====================
app.post('/api/user/deposit', (req, res) => {
  try {
    const { uid, amount, utr, method } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: 'UID & amount required' });
    if (amount < 100) return res.status(400).json({ error: 'Min deposit ₹100' });
    if (!utr || utr.length < 12) return res.status(400).json({ error: 'Valid 12-digit UTR required' });

    const deposits = loadData('deposits');
    const dep = {
      id: genId('dep_'), uid, amount: Number(amount), utr,
      method: method || 'UPI', status: 'PENDING',
      date: new Date().toISOString()
    };
    deposits.push(dep);
    saveData('deposits', deposits);

    console.log(`📥 Deposit request: ${uid} - ₹${amount} - UTR ${utr}`);
    res.json({ message: 'Deposit submitted', deposit: dep });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/deposit-history/:uid', (req, res) => {
  const list = loadData('deposits')
    .filter(d => d.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(list);
});

// ==================== WITHDRAW ====================
app.post('/api/user/withdraw', (req, res) => {
  try {
    const { uid, amount, method, password } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: 'UID & amount required' });

    const user = findUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (amount < 100) return res.status(400).json({ error: 'Min ₹100' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    // Bet requirement check
    const requiredBet = (user.totalDeposit || 0) * 1;
    if ((user.totalBet || 0) < requiredBet) {
      return res.status(400).json({
        error: `Please bet ₹${(requiredBet - (user.totalBet || 0)).toFixed(2)} more to unlock withdrawals`
      });
    }

    const users = loadData('users');
    const ui = users.findIndex(u => u.uid === uid);
    users[ui].balance -= Number(amount);
    users[ui].totalWithdraw = (users[ui].totalWithdraw || 0) + Number(amount);
    saveData('users', users);

    const withdrawals = loadData('withdrawals');
    const wd = {
      id: genId('wd_'), uid, amount: Number(amount), method,
      status: 'PROCESSING',
      details: method === 'bank' ? user.bankDetails : user.upiDetails,
      date: new Date().toISOString()
    };
    withdrawals.push(wd);
    saveData('withdrawals', withdrawals);

    res.json({ message: 'Withdraw submitted', withdrawal: wd, newBalance: users[ui].balance });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/withdraw-history/:uid', (req, res) => {
  const list = loadData('withdrawals')
    .filter(w => w.uid === req.params.uid)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(list);
});

// ==================== BANNERS ====================
app.get('/api/banners', (req, res) => {
  res.json(loadData('banners').filter(b => b.isActive && b.type === 'home'));
});
app.get('/api/banners/popup', (req, res) => {
  res.json(loadData('banners').filter(b => b.isActive && b.type === 'popup'));
});

// ==================== PAGES ====================
const defaultPages = {
  home: { popupBanner: 'https://i.ibb.co/hxyMYWyt/file-00000000192c8211bf1bcf496522a496.png', marqueeText: '🎉 Welcome to DARKWIN! Win big with WinGo', promoText: 'Play. Win. Earn.' },
  deposit: { upiNumber: '7478478039', qrCodeUrl: 'https://i.ibb.co/kVBLF7G6/Screenshot-20260918-145024.png', instructions: 'Scan QR and pay' },
  promotion: { bannerUrl: '', rules: '1. Bonuses credited within 24 hours\n2. Each reward once per day\n3. Fraud forfeits bonuses' },
  agent: { bannerUrl: '', description: 'Invite friends and earn!' }
};
if (!fs.existsSync(path.join(DATA_DIR, 'pages.json'))) saveData('pages', defaultPages);

app.get('/api/pages', (req, res) => res.json(loadData('pages')[0] || defaultPages));
app.get('/api/pages/:pageName', (req, res) => {
  const pages = loadData('pages')[0] || defaultPages;
  res.json(pages[req.params.pageName] || {});
});
app.post('/api/admin/pages/:pageName', (req, res) => {
  let pages = loadData('pages');
  if (!pages[0]) pages = [defaultPages];
  pages[0][req.params.pageName] = { ...pages[0][req.params.pageName], ...req.body };
  saveData('pages', pages);
  res.json({ message: 'Page updated', page: pages[0][req.params.pageName] });
});

// ==================== ADMIN STATS ====================
app.get('/api/admin/stats', (req, res) => {
  const users = loadData('users');
  const txns = loadData('transactions');
  const bets = loadData('bets');
  const deposits = loadData('deposits');
  const withdrawals = loadData('withdrawals');

  res.json({
    totalUsers: users.length,
    bannedUsers: users.filter(u => u.isBanned).length,
    activeToday: users.filter(u => u.lastLogin && new Date(u.lastLogin).toDateString() === new Date().toDateString()).length,
    totalBalance: users.reduce((s, u) => s + (u.balance || 0), 0),
    totalDeposit: deposits.filter(d => d.status === 'APPROVED').reduce((s, d) => s + d.amount, 0),
    totalWithdraw: withdrawals.filter(w => w.status === 'SUCCESS').reduce((s, w) => s + w.amount, 0),
    totalBet: bets.reduce((s, b) => s + b.amount, 0),
    totalPayout: bets.reduce((s, b) => s + (b.payout || 0), 0),
    totalWins: bets.filter(b => b.result === 'win').length,
    totalLosses: bets.filter(b => b.result === 'lose').length,
    pendingDeposits: deposits.filter(d => d.status === 'PENDING').length,
    pendingWithdraws: withdrawals.filter(w => w.status === 'PROCESSING').length
  });
});

app.get('/api/admin/users', (req, res) => {
  const search = (req.query.search || '').toLowerCase();
  let users = loadData('users');
  if (search) users = users.filter(u => u.uid.toLowerCase().includes(search) || u.phone.includes(search));
  res.json(users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/admin/give-bonus', (req, res) => {
  const { uid, bonusAmount, reasonMessage } = req.body;
  const u = findUser(uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  updateUser(uid, { balance: (u.balance || 0) + parseFloat(bonusAmount) });
  const messages = loadData('messages');
  messages.push({
    id: genId('msg_'), uid, title: 'Bonus Received!',
    message: reasonMessage || `You received ₹${bonusAmount} bonus!`,
    date: new Date().toISOString()
  });
  saveData('messages', messages);
  res.json({ message: 'Bonus added' });
});

app.post('/api/admin/ban-user', (req, res) => {
  const { uid, banStatus } = req.body;
  const u = updateUser(uid, { isBanned: banStatus });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ message: `User ${banStatus ? 'banned' : 'unbanned'}` });
});

app.get('/api/admin/deposits', (req, res) => {
  const { status } = req.query;
  let list = loadData('deposits');
  if (status) list = list.filter(d => d.status === status);
  res.json(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/admin/deposit-action', (req, res) => {
  const { id, action } = req.body;
  const deposits = loadData('deposits');
  const i = deposits.findIndex(d => d.id === id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  if (deposits[i].status !== 'PENDING') return res.status(400).json({ error: 'Already processed' });

  if (action === 'approve') {
    const u = findUser(deposits[i].uid);
    if (u) {
      updateUser(u.uid, {
        balance: (u.balance || 0) + deposits[i].amount,
        totalDeposit: (u.totalDeposit || 0) + deposits[i].amount
      });
    }
    deposits[i].status = 'APPROVED';
  } else {
    deposits[i].status = 'REJECTED';
  }
  saveData('deposits', deposits);
  res.json({ message: `Deposit ${action}d` });
});

app.get('/api/admin/withdrawals', (req, res) => {
  const { status } = req.query;
  let list = loadData('withdrawals');
  if (status) list = list.filter(w => w.status === status);
  res.json(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/admin/withdraw-action', (req, res) => {
  const { id, action } = req.body;
  const withdrawals = loadData('withdrawals');
  const i = withdrawals.findIndex(w => w.id === id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  if (withdrawals[i].status !== 'PROCESSING') return res.status(400).json({ error: 'Already processed' });

  if (action === 'approve') {
    withdrawals[i].status = 'SUCCESS';
  } else {
    const u = findUser(withdrawals[i].uid);
    if (u) updateUser(u.uid, { balance: (u.balance || 0) + withdrawals[i].amount });
    withdrawals[i].status = 'REJECTED';
  }
  saveData('withdrawals', withdrawals);
  res.json({ message: `Withdraw ${action}d` });
});

app.post('/api/admin/add-banner', (req, res) => {
  const { title, imageUrl, type } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  const banners = loadData('banners');
  banners.push({
    id: genId('bn_'), title: title || 'Banner', imageUrl,
    type: type || 'home', isActive: true, createdAt: new Date().toISOString()
  });
  saveData('banners', banners);
  res.json({ message: 'Banner added' });
});

app.get('/api/admin/banners', (req, res) => res.json(loadData('banners')));

app.delete('/api/admin/banner/:id', (req, res) => {
  let b = loadData('banners').filter(x => x.id !== req.params.id);
  saveData('banners', b);
  res.json({ message: 'Deleted' });
});

app.post('/api/admin/create-giftcode', (req, res) => {
  const { code, amount, maxUses } = req.body;
  if (!code || !amount) return res.status(400).json({ error: 'code & amount required' });
  const gifts = loadData('giftcodes');
  const upper = code.toUpperCase();
  if (gifts.find(g => g.code === upper)) return res.status(400).json({ error: 'Code exists' });
  gifts.push({
    id: genId('gc_'), code: upper, amount: Number(amount),
    maxUses: Number(maxUses) || 100, usedCount: 0, usedBy: [],
    isActive: true, createdAt: new Date().toISOString()
  });
  saveData('giftcodes', gifts);
  res.json({ message: 'Gift code created' });
});

app.get('/api/admin/giftcodes', (req, res) => res.json(loadData('giftcodes')));

app.get('/api/admin/bets', (req, res) => {
  res.json(loadData('bets').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200));
});

app.get('/api/admin/gameresults', (req, res) => {
  res.json(loadData('gameresults').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100));
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n==========================================');
  console.log('  🎮 DARKWIN API v4.0');
  console.log('==========================================');
  console.log(`  🌐 Port: ${PORT}`);
  console.log(`  📁 Data: ${DATA_DIR}`);
  console.log(`  🎁 Welcome Bonus: ₹58`);
  console.log('==========================================\n');
});
