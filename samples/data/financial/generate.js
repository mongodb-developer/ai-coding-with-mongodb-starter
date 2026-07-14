#!/usr/bin/env node
//
// generate.js: Financial Portfolio Tracker dataset generator
//
// Produces four CSV files:
//   investors.csv         1,000 investors
//   assets.csv            ~50 assets (stocks, crypto, funds, bonds) with REAL tickers
//   transactions.csv      ~30,000 polymorphic transactions (buy/sell/dividend/split)
//   price_snapshots.csv   90 days of daily snapshots per asset, ~4,500 rows
//
// Real ticker symbols are used for stocks, crypto, and funds. Prices are
// plausible historical-ish values; they are NOT claimed to match any real
// market date. The dataset is internally consistent: transactions reference
// real asset_ids and investor_ids; price snapshots reference real asset_ids.
//
// Deterministic via seeded RNG. USD currency, ISO 8601 dates throughout.

'use strict';

const fs = require('fs');
const path = require('path');

// --- Seeded RNG --------------------------------------------------------------

function makeRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(2891);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randFloat(min, max, digits = 2) {
  return Number((rand() * (max - min) + min).toFixed(digits));
}
function uuid() {
  const hex = () => Math.floor(rand() * 16).toString(16);
  let s = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += '-';
    s += hex();
  }
  return s;
}
function pad(n, w) { return String(n).padStart(w, '0'); }
function isoDate(d) { return d.toISOString().slice(0, 10); }

// --- CSV writer --------------------------------------------------------------

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  console.log(`wrote ${filePath} (${rows.length} rows)`);
}

// --- Reference data ----------------------------------------------------------

const FIRST_NAMES = [
  'Aaron','Abigail','Adam','Adrian','Aisha','Alan','Alex','Alice','Allison','Amelia',
  'Andrew','Angela','Anna','Anthony','Antonio','Aria','Arjun','Ashley','Audrey','Austin',
  'Beatriz','Benjamin','Brandon','Brian','Brooke','Caleb','Camila','Carlos','Caroline','Catherine',
  'Charles','Charlotte','Christian','Christine','Christopher','Claire','Daniel','David','Diana','Diego',
  'Dmitri','Edward','Eleanor','Eli','Elizabeth','Emily','Emma','Eric','Esther','Ethan',
  'Eugene','Evelyn','Felix','Fernando','Frederick','Gabriel','Gabriela','George','Grace','Gregory',
  'Hannah','Harold','Heather','Helen','Henry','Hiroshi','Ibrahim','Imani','Isabella','Isaac',
  'Jacob','James','Jasmine','Javier','Jeffrey','Jennifer','Jessica','Joel','John','Jonathan',
  'Jordan','Joseph','Joshua','Julia','Justin','Karen','Katherine','Kavya','Kenneth','Kevin',
  'Kimberly','Lauren','Leah','Leon','Linda','Lisa','Logan','Louis','Lucas','Maddison',
  'Marcus','Margaret','Maria','Mark','Martin','Mary','Matthew','Megan','Melissa','Michael',
  'Miguel','Mitchell','Natalie','Nathan','Nicholas','Olivia','Patricia','Paul','Peter','Philip',
  'Priya','Rachel','Raj','Rebecca','Richard','Robert','Roman','Ruth','Ryan','Sabrina',
  'Samuel','Sandra','Sarah','Scott','Shreya','Sophia','Stephen','Steven','Susan','Tanvi',
  'Tariq','Theodore','Thomas','Tiffany','Timothy','Tomas','Valeria','Victor','Victoria','Vincent',
  'Walter','Warren','William','Xavier','Yusuf','Zachary','Zoe'
];

const LAST_NAMES = [
  'Adams','Aguilar','Allen','Anderson','Bailey','Baker','Bauer','Bennett','Brooks','Brown',
  'Bryant','Burns','Campbell','Carter','Castro','Chen','Cho','Clark','Cohen','Coleman',
  'Collins','Cook','Cooper','Cox','Davis','Diaz','Dixon','Edwards','Evans','Fischer',
  'Fleming','Foster','Garcia','Gibson','Gomez','Gonzalez','Graham','Greene','Hall','Hamilton',
  'Harris','Hassan','Hayes','Henderson','Hernandez','Hill','Hoffman','Howard','Hughes','Ito',
  'Jackson','Jacobs','James','Jenkins','Johnson','Jones','Kapoor','Kelly','Kim','King',
  'Klein','Lee','Lewis','Lin','Long','Lopez','Martin','Martinez','Mason','Miller',
  'Mitchell','Moore','Morgan','Morris','Murphy','Nakamura','Nelson','Nguyen','Novak','Okafor',
  'Olsen','Ortega','Park','Parker','Patel','Patterson','Perez','Peters','Phillips','Powell',
  'Price','Quinn','Ramirez','Reed','Reyes','Reynolds','Rivera','Roberts','Robinson','Rodriguez',
  'Rogers','Rosen','Russell','Saito','Sanchez','Sanders','Santos','Schwartz','Scott','Sharma',
  'Shaw','Silva','Simmons','Smith','Stewart','Suarez','Sullivan','Tanaka','Taylor','Thomas',
  'Thompson','Torres','Tran','Turner','Vargas','Wagner','Walker','Wang','Watson','White',
  'Williams','Wilson','Wong','Wright','Xu','Yamada','Young','Zhang'
];

// --- Assets: REAL ticker symbols ---------------------------------------------
//
// Stocks: actual NYSE/NASDAQ tickers across major sectors.
// Crypto: actual symbols.
// Funds: actual mutual fund / ETF tickers.
// Bonds: synthetic CUSIP-style identifiers.
//
// Plausible "anchor" prices are used as a starting point for snapshot
// generation. These are not claimed to match any real market date.

const STOCK_DEFS = [
  ['AAPL','Apple Inc.','technology','US','NASDAQ', 195.00],
  ['MSFT','Microsoft Corporation','technology','US','NASDAQ', 415.00],
  ['GOOGL','Alphabet Inc. Class A','technology','US','NASDAQ', 175.00],
  ['AMZN','Amazon.com Inc.','consumer_discretionary','US','NASDAQ', 185.00],
  ['NVDA','NVIDIA Corporation','technology','US','NASDAQ', 920.00],
  ['META','Meta Platforms Inc.','technology','US','NASDAQ', 510.00],
  ['TSLA','Tesla Inc.','consumer_discretionary','US','NASDAQ', 195.00],
  ['BRK.B','Berkshire Hathaway Inc. Class B','financials','US','NYSE', 425.00],
  ['JPM','JPMorgan Chase & Co.','financials','US','NYSE', 200.00],
  ['V','Visa Inc.','financials','US','NYSE', 280.00],
  ['MA','Mastercard Incorporated','financials','US','NYSE', 460.00],
  ['UNH','UnitedHealth Group Incorporated','healthcare','US','NYSE', 525.00],
  ['JNJ','Johnson & Johnson','healthcare','US','NYSE', 158.00],
  ['LLY','Eli Lilly and Company','healthcare','US','NYSE', 760.00],
  ['PFE','Pfizer Inc.','healthcare','US','NYSE', 28.50],
  ['XOM','Exxon Mobil Corporation','energy','US','NYSE', 115.00],
  ['CVX','Chevron Corporation','energy','US','NYSE', 158.00],
  ['HD','The Home Depot Inc.','consumer_discretionary','US','NYSE', 360.00],
  ['WMT','Walmart Inc.','consumer_staples','US','NYSE', 60.00],
  ['PG','The Procter & Gamble Company','consumer_staples','US','NYSE', 165.00],
  ['KO','The Coca-Cola Company','consumer_staples','US','NYSE', 62.00],
  ['PEP','PepsiCo Inc.','consumer_staples','US','NASDAQ', 175.00],
  ['DIS','The Walt Disney Company','communication_services','US','NYSE', 110.00],
  ['NFLX','Netflix Inc.','communication_services','US','NASDAQ', 615.00],
  ['ADBE','Adobe Inc.','technology','US','NASDAQ', 535.00],
  ['CRM','Salesforce Inc.','technology','US','NYSE', 295.00],
  ['ORCL','Oracle Corporation','technology','US','NYSE', 130.00],
  ['CSCO','Cisco Systems Inc.','technology','US','NASDAQ', 50.00],
  ['INTC','Intel Corporation','technology','US','NASDAQ', 30.00],
  ['BA','The Boeing Company','industrials','US','NYSE', 180.00],
  ['CAT','Caterpillar Inc.','industrials','US','NYSE', 365.00],
  ['GE','General Electric Company','industrials','US','NYSE', 165.00],
  ['MMM','3M Company','industrials','US','NYSE', 100.00],
  ['NKE','NIKE Inc.','consumer_discretionary','US','NYSE', 100.00],
  ['SBUX','Starbucks Corporation','consumer_discretionary','US','NASDAQ', 95.00]
];

const CRYPTO_DEFS = [
  ['BTC','Bitcoin','crypto','-','CRYPTO', 67000.00],
  ['ETH','Ethereum','crypto','-','CRYPTO', 3400.00],
  ['SOL','Solana','crypto','-','CRYPTO', 165.00],
  ['ADA','Cardano','crypto','-','CRYPTO', 0.62],
  ['DOT','Polkadot','crypto','-','CRYPTO', 7.85],
  ['MATIC','Polygon','crypto','-','CRYPTO', 0.92],
  ['LINK','Chainlink','crypto','-','CRYPTO', 18.50]
];

const FUND_DEFS = [
  ['VTSAX','Vanguard Total Stock Market Index Fund Admiral Shares','diversified','US','MUTUALFUND', 122.00],
  ['VFIAX','Vanguard 500 Index Fund Admiral Shares','diversified','US','MUTUALFUND', 510.00],
  ['VTIAX','Vanguard Total International Stock Index Admiral','international','US','MUTUALFUND', 33.50],
  ['VBTLX','Vanguard Total Bond Market Index Admiral','bond','US','MUTUALFUND', 9.85],
  ['SPY','SPDR S&P 500 ETF Trust','diversified','US','NYSEARCA', 510.00],
  ['QQQ','Invesco QQQ Trust','technology','US','NASDAQ', 440.00],
  ['VTI','Vanguard Total Stock Market ETF','diversified','US','NYSEARCA', 250.00],
  ['VXUS','Vanguard Total International Stock ETF','international','US','NASDAQ', 60.00],
  ['BND','Vanguard Total Bond Market ETF','bond','US','NASDAQ', 73.00],
  ['VOO','Vanguard S&P 500 ETF','diversified','US','NYSEARCA', 470.00]
];

const BOND_DEFS = [
  // Synthetic CUSIPs but with realistic-looking US Treasury and corporate names
  ['912828YR4','US Treasury Note 4.25% 2030','treasury','US','BOND', 99.85],
  ['912810SX7','US Treasury Bond 3.75% 2049','treasury','US','BOND', 92.40],
  ['037833DV9','Apple Inc. Corporate Bond 4.50% 2034','corporate','US','BOND', 100.20],
  ['594918BQ8','Microsoft Corp. Corporate Bond 3.95% 2032','corporate','US','BOND', 98.75]
];

const allAssetDefs = [
  ...STOCK_DEFS.map(d => ['stock', ...d]),
  ...CRYPTO_DEFS.map(d => ['crypto', ...d]),
  ...FUND_DEFS.map(d => ['fund', ...d]),
  ...BOND_DEFS.map(d => ['bond', ...d])
];

const assets = allAssetDefs.map(([asset_type, symbol, name, sector, country, exchange, anchorPrice]) => ({
  asset_id: uuid(),
  symbol,
  name,
  asset_type,
  sector,
  country,
  exchange,
  anchor_price: anchorPrice
}));

// --- Investors ---------------------------------------------------------------

const investors = [];
const RISK_TOLERANCES = [['conservative', 25], ['moderate', 50], ['aggressive', 25]];
for (let i = 1; i <= 1000; i++) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const daysAgo = randInt(60, 8 * 365);
  const joined = new Date(Date.now() - daysAgo * 86400000);
  investors.push({
    investor_id: uuid(),
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1, 999)}@example.com`,
    joined_date: isoDate(joined),
    base_currency: 'USD',
    risk_tolerance: pickWeighted(RISK_TOLERANCES)
  });
}

// --- Price snapshots ---------------------------------------------------------
//
// 90 days of daily snapshots per asset. Random walk from anchor with bounded
// daily volatility. Higher volatility for crypto, lower for bonds.

const SNAP_DAYS = 90;
const today = new Date();
today.setHours(0, 0, 0, 0);

const priceSnapshots = [];
const latestPriceByAssetId = {};
for (const a of assets) {
  let price = a.anchor_price;
  // Walk backwards 90 days, then reverse so chronological order is correct.
  const walks = [];
  let dailyVol;
  if (a.asset_type === 'crypto') dailyVol = 0.045;       // ~4.5%
  else if (a.asset_type === 'stock') dailyVol = 0.018;   // ~1.8%
  else if (a.asset_type === 'fund') dailyVol = 0.012;    // ~1.2%
  else dailyVol = 0.004;                                 // bond ~0.4%

  let workingPrice = a.anchor_price;
  for (let i = 0; i < SNAP_DAYS; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // Random walk
    const driftPct = (rand() - 0.5) * 2 * dailyVol;
    workingPrice = Math.max(0.01, workingPrice * (1 + driftPct));
    // Generate OHLCV from a plausible intraday range
    const intraVol = dailyVol * 0.6;
    const open = workingPrice * (1 + (rand() - 0.5) * 2 * intraVol * 0.4);
    const close = workingPrice;
    const high = Math.max(open, close) * (1 + rand() * intraVol * 0.6);
    const low = Math.min(open, close) * (1 - rand() * intraVol * 0.6);
    let volume;
    if (a.asset_type === 'stock') volume = randInt(1_000_000, 80_000_000);
    else if (a.asset_type === 'crypto') volume = randInt(100_000, 5_000_000);
    else if (a.asset_type === 'fund') volume = randInt(50_000, 8_000_000);
    else volume = randInt(1_000, 50_000);
    walks.push({
      asset_id: a.asset_id,
      snapshot_date: isoDate(date),
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume
    });
  }
  // Reverse so oldest first
  walks.reverse();
  for (const w of walks) priceSnapshots.push(w);
  latestPriceByAssetId[a.asset_id] = walks[walks.length - 1].close;
}

// --- Transactions ------------------------------------------------------------
//
// Each investor has 5-100 transactions across the asset universe. Stocks
// produce occasional dividends and rare splits. Buys/sells dominate.

const TXN_TYPES_BUY_SELL = [['buy', 70], ['sell', 30]];

const transactions = [];
for (const inv of investors) {
  // How many distinct assets does this investor hold?
  const assetCount = pickWeighted([[3,15],[5,25],[8,25],[12,15],[18,10],[25,7],[40,3]]);
  const heldAssets = [];
  // Risk tolerance influences which asset types they hold
  const stockBias = inv.risk_tolerance === 'conservative' ? 0.4 : inv.risk_tolerance === 'moderate' ? 0.6 : 0.7;
  const cryptoBias = inv.risk_tolerance === 'conservative' ? 0.0 : inv.risk_tolerance === 'moderate' ? 0.05 : 0.20;
  const fundBias = inv.risk_tolerance === 'conservative' ? 0.35 : inv.risk_tolerance === 'moderate' ? 0.25 : 0.10;
  // bond bias = remainder

  while (heldAssets.length < assetCount) {
    const r = rand();
    let pool;
    if (r < stockBias) pool = assets.filter(a => a.asset_type === 'stock');
    else if (r < stockBias + cryptoBias) pool = assets.filter(a => a.asset_type === 'crypto');
    else if (r < stockBias + cryptoBias + fundBias) pool = assets.filter(a => a.asset_type === 'fund');
    else pool = assets.filter(a => a.asset_type === 'bond');
    if (pool.length === 0) continue;
    const candidate = pick(pool);
    if (!heldAssets.includes(candidate)) heldAssets.push(candidate);
  }

  for (const asset of heldAssets) {
    // Buy/sell sequence over the last few years
    const txnCount = pickWeighted([[1,30],[2,25],[3,20],[5,15],[8,7],[15,3]]);
    let netQty = 0;
    for (let n = 0; n < txnCount; n++) {
      const type = netQty <= 0 ? 'buy' : pickWeighted(TXN_TYPES_BUY_SELL);
      const daysAgo = randInt(1, 3 * 365);
      const txDate = new Date(today);
      txDate.setDate(txDate.getDate() - daysAgo);

      // Quantity differs by asset type
      let qty;
      if (asset.asset_type === 'crypto') qty = randFloat(0.01, 5.0, 4);
      else if (asset.asset_type === 'bond') qty = randInt(1, 25);
      else qty = randInt(1, 200);

      // Simulated buy/sell price near the anchor with some variance
      const priceVar = (rand() - 0.5) * 0.4;
      const pricePerUnit = Number((asset.anchor_price * (1 + priceVar)).toFixed(4));
      const grossAmount = Number((pricePerUnit * qty).toFixed(2));
      const fee = type === 'buy' || type === 'sell'
        ? (asset.asset_type === 'crypto' ? Number((grossAmount * 0.005).toFixed(2)) : randFloat(0.99, 9.99, 2))
        : 0;
      const totalAmount = type === 'buy'
        ? Number((grossAmount + fee).toFixed(2))
        : Number((grossAmount - fee).toFixed(2));

      transactions.push({
        transaction_id: uuid(),
        investor_id: inv.investor_id,
        asset_id: asset.asset_id,
        transaction_type: type,
        quantity: qty,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        fee,
        transaction_date: isoDate(txDate)
      });

      if (type === 'buy') netQty += qty; else netQty -= qty;
    }

    // Stocks pay occasional dividends. Funds too. Roughly 1 in 3 holdings receives one.
    if ((asset.asset_type === 'stock' || asset.asset_type === 'fund') && rand() < 0.35) {
      const divAmt = Number((Math.max(0, netQty) * randFloat(0.20, 1.50, 2)).toFixed(2));
      if (divAmt > 0) {
        const daysAgo = randInt(1, 200);
        const divDate = new Date(today);
        divDate.setDate(divDate.getDate() - daysAgo);
        transactions.push({
          transaction_id: uuid(),
          investor_id: inv.investor_id,
          asset_id: asset.asset_id,
          transaction_type: 'dividend',
          quantity: 0,
          price_per_unit: 0,
          total_amount: divAmt,
          fee: 0,
          transaction_date: isoDate(divDate)
        });
      }
    }

    // Rare stock splits
    if (asset.asset_type === 'stock' && rand() < 0.02) {
      const ratio = pick([2, 3, 4]);
      const daysAgo = randInt(60, 2 * 365);
      const splitDate = new Date(today);
      splitDate.setDate(splitDate.getDate() - daysAgo);
      transactions.push({
        transaction_id: uuid(),
        investor_id: inv.investor_id,
        asset_id: asset.asset_id,
        transaction_type: 'split',
        quantity: ratio, // store the ratio as the quantity
        price_per_unit: 0,
        total_amount: 0,
        fee: 0,
        transaction_date: isoDate(splitDate)
      });
    }
  }
}

// --- Audit log ---------------------------------------------------------------
//
// Append-only record of meaningful state changes on the investor (the
// primary subject entity for this scenario). Universal across all three
// workshop scenarios so attendees can reason about it generically:
// fields are identical; only the event_type values are scenario-flavored.

const AUDIT_EVENT_TYPES = [
  ['risk_tolerance_changed', 5],
  ['email_updated', 15],
  ['address_updated', 12],
  ['phone_updated', 10],
  ['kyc_review_completed', 6],
  ['2fa_enabled', 6],
  ['password_reset', 12],
  ['advisor_assigned', 4],
  ['statement_emailed', 20],
  ['login_failed', 10]
];
const AUDIT_ACTORS = [['user', 60], ['system', 30], ['admin', 10]];

function makeAuditDetails(eventType) {
  switch (eventType) {
    case 'risk_tolerance_changed':
      return `risk_tolerance changed to ${pick(['conservative','moderate','aggressive'])}`;
    case 'email_updated':        return 'email address updated';
    case 'address_updated':      return 'mailing address updated';
    case 'phone_updated':        return 'phone number updated';
    case 'kyc_review_completed': return 'KYC review completed (status: passed)';
    case '2fa_enabled':          return 'two-factor authentication enabled';
    case 'password_reset':       return 'password reset completed';
    case 'advisor_assigned':     return 'advisor assignment updated';
    case 'statement_emailed':    return 'monthly statement emailed';
    case 'login_failed':         return 'login attempt failed';
    default:                     return eventType;
  }
}

const auditLog = [];
for (const inv of investors) {
  const eventCount = randInt(3, 25);
  for (let i = 0; i < eventCount; i++) {
    const eventType = pickWeighted(AUDIT_EVENT_TYPES);
    const actor = pickWeighted(AUDIT_ACTORS);
    const daysAgo = randInt(1, 3 * 365);
    const eventDate = new Date(today);
    eventDate.setDate(eventDate.getDate() - daysAgo);
    eventDate.setHours(randInt(0, 23), randInt(0, 59), 0, 0);
    auditLog.push({
      log_id: uuid(),
      subject_id: inv.investor_id,
      subject_type: 'investor',
      event_type: eventType,
      actor,
      event_date: eventDate.toISOString(),
      details: makeAuditDetails(eventType)
    });
  }
}

// --- Write outputs -----------------------------------------------------------

const OUT_DIR = path.resolve(__dirname);

writeCsv(
  path.join(OUT_DIR, 'investors.csv'),
  ['investor_id','name','email','joined_date','base_currency','risk_tolerance'],
  investors
);

// Drop the anchor_price helper field before writing
const assetsForCsv = assets.map(({ anchor_price, ...rest }) => rest);
writeCsv(
  path.join(OUT_DIR, 'assets.csv'),
  ['asset_id','symbol','name','asset_type','sector','country','exchange'],
  assetsForCsv
);
writeCsv(
  path.join(OUT_DIR, 'transactions.csv'),
  ['transaction_id','investor_id','asset_id','transaction_type','quantity','price_per_unit','total_amount','fee','transaction_date'],
  transactions
);
writeCsv(
  path.join(OUT_DIR, 'price_snapshots.csv'),
  ['asset_id','snapshot_date','open','high','low','close','volume'],
  priceSnapshots
);
writeCsv(
  path.join(OUT_DIR, 'audit_log.csv'),
  ['log_id','subject_id','subject_type','event_type','actor','event_date','details'],
  auditLog
);

console.log('---');
console.log(`investors:       ${investors.length}`);
console.log(`assets:          ${assets.length}`);
console.log(`transactions:    ${transactions.length}`);
console.log(`price_snapshots: ${priceSnapshots.length}`);
console.log(`audit_log:       ${auditLog.length}`);
