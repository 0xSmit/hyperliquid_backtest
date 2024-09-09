const fs = require('fs');
const xlsx = require('xlsx');
const moment = require('moment');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Define the project root and output directory
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

/**
 * Function to parse CSV and sanitize the trades
 * @param {string} filePath - Path to the CSV file
 * @param {string[]} [coinFilter] - Optional array of coin names to filter
 */
function sanitize(filePath, coinFilter = null) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const trades = xlsx.utils.sheet_to_json(sheet, { raw: false });

  console.log(`Total trades before filtering: ${trades.length}`);

  // Convert trade data to the required format and sort by date
  let formattedTrades = trades
    .map((row) => ({
      time: moment(row.time, 'DD/MM/YYYY - HH:mm:ss'),
      coin: row.coin,
      dir: row.dir,
      px: parseFloat(row.px),
      sz: parseFloat(row.sz),
      ntl: parseFloat(row.ntl),
      fee: parseFloat(row.fee),
      closedPnl: parseFloat(row.closedPnl),
    }))
    .sort((a, b) => a.time - b.time);

  console.log(`Total formatted trades: ${formattedTrades.length}`);

  // Apply coin filter if provided
  if (coinFilter && Array.isArray(coinFilter) && coinFilter.length > 0) {
    formattedTrades = formattedTrades.filter((trade) => coinFilter.includes(trade.coin));
    console.log(`Filtered trades for coins: ${coinFilter.join(', ')}`);
    console.log(`Total trades after coin filtering: ${formattedTrades.length}`);
  }

  // Filter trades into different categories
  const openLongTrades = formattedTrades.filter((trade) => trade.dir.includes('Open Long'));
  const closeLongTrades = formattedTrades.filter((trade) => trade.dir.includes('Close Long'));
  const openShortTrades = formattedTrades.filter((trade) => trade.dir.includes('Open Short'));
  const closeShortTrades = formattedTrades.filter((trade) => trade.dir.includes('Close Short'));
  const otherTrades = formattedTrades.filter(
    (trade) =>
      !trade.dir.includes('Open Long') &&
      !trade.dir.includes('Close Long') &&
      !trade.dir.includes('Open Short') &&
      !trade.dir.includes('Close Short')
  );

  // Calculate total sizes
  const totalOpenLongSize = openLongTrades.reduce((sum, trade) => sum + trade.sz, 0);
  const totalCloseLongSize = closeLongTrades.reduce((sum, trade) => sum + trade.sz, 0);
  const totalOpenShortSize = openShortTrades.reduce((sum, trade) => sum + trade.sz, 0);
  const totalCloseShortSize = closeShortTrades.reduce((sum, trade) => sum + trade.sz, 0);

  console.log(`Open Long Trades: ${openLongTrades.length}, Total Size: ${totalOpenLongSize.toFixed(4)}`);
  console.log(`Close Long Trades: ${closeLongTrades.length}, Total Size: ${totalCloseLongSize.toFixed(4)}`);
  console.log(`Open Short Trades: ${openShortTrades.length}, Total Size: ${totalOpenShortSize.toFixed(4)}`);
  console.log(`Close Short Trades: ${closeShortTrades.length}, Total Size: ${totalCloseShortSize.toFixed(4)}`);
  console.log(`Other Trades: ${otherTrades.length}`);

  // Check for size mismatch
  const openSize = totalOpenLongSize + totalOpenShortSize;
  const closeSize = totalCloseLongSize + totalCloseShortSize;
  if (Math.abs(openSize - closeSize) > 0.0001) {
    // Using a small threshold to account for potential floating-point imprecision
    console.warn(`Warning: Mismatch between open and close trade sizes`);
    console.warn(`Total Open Size: ${openSize.toFixed(4)}, Total Close Size: ${closeSize.toFixed(4)}`);
    console.warn(`Difference: ${Math.abs(openSize - closeSize).toFixed(4)}`);
  } else {
    console.log(`Open and close trade sizes match: ${openSize.toFixed(4)}`);
  }

  // Write filtered trades to separate CSV files
  writeTradesToCsv('open_long_trades.csv', openLongTrades);
  writeTradesToCsv('close_long_trades.csv', closeLongTrades);
  writeTradesToCsv('open_short_trades.csv', openShortTrades);
  writeTradesToCsv('close_short_trades.csv', closeShortTrades);
  writeTradesToCsv('other_trades.csv', otherTrades);
}

/**
 * Function to write trades to a CSV file
 * @param {string} fileName - Name of the CSV file
 * @param {Array} trades - Array of trade objects
 */
function writeTradesToCsv(fileName, trades) {
  const outputPath = path.join(outputDir, fileName);
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'time', title: 'Time' },
      { id: 'coin', title: 'Coin' },
      { id: 'dir', title: 'Direction' },
      { id: 'px', title: 'Price' },
      { id: 'sz', title: 'Size' },
      { id: 'ntl', title: 'Notional' },
      { id: 'fee', title: 'Fee' },
      { id: 'closedPnl', title: 'Closed PnL' },
    ],
  });

  const records = trades.map((trade) => ({
    time: trade.time.format('DD/MM/YYYY - HH:mm:ss'),
    coin: trade.coin,
    dir: trade.dir,
    px: trade.px,
    sz: trade.sz,
    ntl: trade.ntl,
    fee: trade.fee,
    closedPnl: trade.closedPnl,
  }));

  csvWriter.writeRecords(records).then(() => {
    console.log(`${fileName} has been written successfully`);
  });
}

// Run the sanitize function
const tradesFilePath = path.join(projectRoot, 'data', 'trades.csv');

// Example usage:
// To filter for specific coins, uncomment the next line and add the desired coin names
const coinFilter = ['ETH'];
sanitize(tradesFilePath, coinFilter);

// To process all coins, use:
// sanitize(tradesFilePath);
