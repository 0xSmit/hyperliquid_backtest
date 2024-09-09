const fs = require('fs');
const xlsx = require('xlsx');
const moment = require('moment');

// Initial pool balance
let poolBalanceUSDC = 100000000; // 100 million USDC
let poolBalanceETH = 0; // ETH balance for long pool

// Total loss tracker
let totalLoss = 0;

// Interest rate
const dailyInterestRate = 0.01; // 1% daily

// Open positions tracker
const openPositions = [];

let totalUserGrossProfit = 0;
let totalUserNetProfit = 0;
let totalInterestPaid = 0;

/**
 * Function to parse CSV and backtest the strategy
 * @param {string} filePath - Path to the CSV file
 * @param {string} coin - Coin to perform calculations for
 */
function backtest(filePath, coin) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const trades = xlsx.utils.sheet_to_json(sheet, { raw: false });

  // Convert trade data to the required format and sort by date
  const formattedTrades = trades
    .map((row) => ({
      time: moment(row.time, 'DD/MM/YYYY - HH:mm:ss'),
      coin: row.coin,
      dir: row.dir,
      px: parseFloat(row.px),
      sz: parseFloat(row.sz),
      // Remove these lines if not needed
      // ntl: parseFloat(row.ntl),
      // fee: parseFloat(row.fee),
      // closedPnl: parseFloat(row.closedPnl),
    }))
    .sort((a, b) => a.time - b.time);

  processTrades(formattedTrades, coin);
}

/**
 * Function to process trades and calculate pool profitability
 * @param {Array} trades - Array of trade objects
 * @param {string} coin - Coin to perform calculations for
 */
function processTrades(trades, coin) {
  trades.forEach((trade) => {
    if (trade.coin === coin) {
      if (trade.dir.includes('Open Long')) {
        handleOpenLong(trade);
      } else if (trade.dir.includes('Close Long')) {
        const { userGrossProfit, userNetProfit, interestPaid } = handleCloseLong(trade);
        totalUserGrossProfit += userGrossProfit;
        totalUserNetProfit += userNetProfit;
        totalInterestPaid += interestPaid;
      }
    }
  });

  const initialBalance = 100000000; // 100 million USDC
  const finalBalance = poolBalanceUSDC;
  const overallProfit = finalBalance - initialBalance;

  console.log(`\n`);
  console.log(`Backtesting results for ${coin}:`);
  console.log(`Initial Pool Balance: ${initialBalance.toFixed(2)} USDC`);
  console.log(`Final Pool Balance: ${finalBalance.toFixed(2)} USDC`);
  console.log(`Total Interest Earned by Pool: ${totalInterestPaid.toFixed(2)} USDC`);
  console.log(`Total Loss Borne by Pool: ${totalLoss.toFixed(2)} USDC`);
  console.log(`Overall Profit: ${overallProfit.toFixed(2)} USDC`);
  console.log(`\n`);
  console.log(`Total User Gross Profit: ${totalUserGrossProfit.toFixed(2)} USDC`);
  console.log(`Total Interest paid by user: ${totalInterestPaid.toFixed(2)} USDC`);
  console.log(`Total User Net Profit: ${totalUserNetProfit.toFixed(2)} USDC`);
}

/**
 * Handle opening a long position
 * @param {Object} trade - Trade object
 */
function handleOpenLong(trade) {
  const cost = trade.px * trade.sz;
  if (poolBalanceUSDC >= cost) {
    poolBalanceUSDC -= cost;
    openPositions.push({
      size: trade.sz,
      openPrice: trade.px,
      openTime: trade.time,
    });
    console.log(`Opened Long: Bought ${trade.sz} ETH at ${trade.px}, Cost: ${cost} USDC`);
  } else {
    console.log('Insufficient USDC in pool to open long position');
  }
}

/**
 * Handle closing a long position
 * @param {Object} trade - Trade object
 */
function handleCloseLong(trade) {
  let remainingSize = trade.sz;
  let totalClosingValue = 0;
  let totalInterest = 0;
  let totalInitialCost = 0;
  let positionsClosed = 0;
  let userGrossProfit = 0;

  while (remainingSize > 0 && openPositions.length > 0) {
    const oldestPosition = openPositions[0];
    const closingSize = Math.min(remainingSize, oldestPosition.size);

    const daysHeld = trade.time.diff(oldestPosition.openTime, 'days', true);
    const closingValue = trade.px * closingSize;
    const interest = calculateInterest(oldestPosition, trade.time, closingSize);
    const initialCost = closingSize * oldestPosition.openPrice;

    // Calculate how much goes to the pool (up to the initial cost)
    const toPool = Math.min(closingValue, initialCost);
    // Calculate user's profit (if any)
    const profit = Math.max(0, closingValue - initialCost);

    totalClosingValue += closingValue;
    totalInterest += interest;
    totalInitialCost += initialCost;
    positionsClosed++;
    userGrossProfit += profit;

    // Update pool balance
    poolBalanceUSDC += toPool + interest;

    oldestPosition.size -= closingSize;
    remainingSize -= closingSize;

    if (oldestPosition.size === 0) {
      openPositions.shift();
    }
  }

  const loss = Math.max(0, totalInitialCost - totalClosingValue);
  totalLoss += loss;

  // User's net profit is gross profit minus interest
  const userNetProfit = userGrossProfit - totalInterest;

  console.log(
    `Closed Long: Sold ${trade.sz} ETH at ${trade.px}, Closing Value: ${totalClosingValue.toFixed(2)} USDC, ` +
      `Interest: ${totalInterest.toFixed(2)} USDC, Pool Loss: ${loss.toFixed(2)} USDC, ` +
      `User Gross Profit: ${userGrossProfit.toFixed(2)} USDC, ` +
      `User Net Profit: ${userNetProfit.toFixed(2)} USDC`
  );

  if (remainingSize > 0) {
    console.log(`Warning: Attempted to close more ETH than available in open positions. Excess: ${remainingSize} ETH`);
  }

  return { userGrossProfit, userNetProfit, interestPaid: totalInterest };
}

/**
 * Calculate interest accrued for a trade
 * @param {Object} position - Position object
 * @param {moment} closeTime - Close time of the trade
 * @param {number} closedSize - Size of the position being closed
 * @returns {number} - Interest amount
 */
function calculateInterest(position, closeTime, closedSize) {
  const daysHeld = Math.ceil(closeTime.diff(position.openTime, 'days', true));
  const interest = position.openPrice * closedSize * dailyInterestRate * daysHeld;
  return interest;
}

// Run the backtest
const coinToBacktest = 'ETH'; // Change this to the coin you want to backtest
backtest('./data/trades.csv', coinToBacktest);
