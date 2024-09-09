# Hyperliquid trades backtest

This Node.js script backtests a cryptocurrency trading pool strategy for long positions.

## What it does

- Simulates a trading pool with an initial balance of 100 million USDC
- When a position is opened, the pool balance is reduced by the size of the position
- When a position is closed, the pool balance is increased by the size of the position upto the initial position size
- Interest is calculated daily and charged to the user
- User pays a 1% daily interest fee
- The Loss is absorbed by the pool, and the profits are paid to the user

## Requirements

- Node.js
- npm

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies (xlsx and moment)

## Usage

1. Prepare your trade data in a CSV file (default: `./data/trades.csv`)
2. Set the `coinToBacktest` variable in `index.js` (default is 'ETH')
3. Run the script: `node index.js`

## Configuration

- `dailyInterestRate`: Set in the script (default: 1% or 0.01)
- Initial pool balance: Set in the script (default: 100 million USDC)

## Output

The script outputs individual trade details and summary statistics including:

- Final pool balance
- Total interest earned
- Total losses
- User gross and net profits

## Notes

- The pool absorbs losses when a position is closed at a lower price
- Users profit only when closing at a higher price than opening
- Interest is calculated daily and charged to the user
