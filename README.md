# cbBTC trend rail — entry for `btc-race-24h-20261123-0511`

A long-only minute-bar bot for the make.fun *Race a BTC trading bot live for 24 hours* board.
It trades Coinbase Wrapped BTC (cbBTC) against USDC in the house `bars-replay/v1` replay, with
$1,000 of paper money and nothing traded for real.

## Strategy

Cash earns nothing and a full round trip costs about 26 bps (4 bps fee, 2 bps slippage and the
order's own price impact), so the bot does not scalp. It holds the asset while the trend is up and
stands aside when it is not:

- trend line: the mean of the last **60** one-minute closes (one hour);
- buy when the close is **100 bps above** the trend line;
- sell when the close is **100 bps below** it, or when it gives back **400 bps** from the best close
  since entry.

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
