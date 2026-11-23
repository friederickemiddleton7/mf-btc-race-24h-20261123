# cbBTC trend rail — entry for `btc-race-24h-20261123-0511`

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/friederickemiddleton7/mf-btc-race-24h-20261123/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/friederickemiddleton7/mf-btc-race-24h-20261123/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Bounty page: https://make.fun/bounty/btc-race-24h-20261123-0511

A long-only minute-bar bot for the make.fun *Race a BTC trading bot live for 24 hours* board.
It trades Coinbase Wrapped BTC (cbBTC) against USDC in the house `bars-replay/v1` replay, with
$1,000 of paper money and nothing traded for real.

## Strategy

Cash earns nothing and a full round trip costs about 26 bps (4 bps fee, 2 bps slippage and the
order's own price impact), so the bot does not scalp. It holds the asset while the trend is up and
stands aside when it is not:

- trend line: the mean of the last **60** one-minute closes (`TREND_BARS = 60`, one hour),
  truncated to an integer; nothing is traded before 60 closes exist;
- buy when the close is strictly more than **100 bps above** the trend line (`BAND_BPS = 100`),
  spending `min(cash, caps.max_weight_bps x equity / 10000)` and nothing below
  `fees.min_notional_quote_units`;
- sell the whole position when the close is strictly more than **100 bps below** the trend line,
  or when it gives back **400 bps** from the best close since entry (`HARD_STOP_BPS = 400`),
  whichever comes first;
- no order at all while `state.warmingUp`.

Every comparison is integer bigint on the harness's own quote units — no float decides an order.

The band is hysteresis: without it a price sitting on the line would buy and sell every minute and
pay the round trip each time, which is exactly how a busy baseline loses 11% on a rising day.

## Files

- `main.ts` — the bot. Node 22, standard library only, vendored SDK in `vendor/`.
- `vendor/makefun-bars.ts` — the harness SDK shipped with the kit, byte for byte.

## Running it as the grader does

```sh
node --experimental-strip-types main.ts < bars.jsonl
```

Everything the bot decides comes from the bars on stdin: no clock, no network, no files outside the
repository, and two runs over the same data produce the same orders.

## Local dev-window grade

`makefun grade-local` on the published dev window: net PnL **+1.9881%** of the $1,000 bankroll
(1 round trip, max drawdown 1.98%, fees 0.808 USDC), which clears the dev gate (net PnL above zero).

## License

MIT.
