// cbBTC trend rail: hold the coin while it trades above its own moving average, stand aside otherwise.
//
// Why not scalp. A full round trip costs about 26 bps all in: the venue fee, the modelled slippage and
// the order's own price impact on the pool. Cash earns nothing while it waits. So a one-minute wiggle
// is never worth chasing: the bot only pays the round trip when the move it rides is clearly bigger
// than that cost. That is exactly how the busy baselines burn ~11% on a rising day.
//
// The rail. Keep every close, and take the mean of the last TREND_BARS of them as the trend line.
// Buy only when the close is more than BAND_BPS above that line; sell only when the close is more
// than BAND_BPS below it, or when it gives back HARD_STOP_BPS from the best close since entry.
// That band either side of the line is the hysteresis: a price sitting right on the line would
// otherwise buy and sell every single minute and hand the round trip back to the venue each time.
//
// All of it is integer bigint on the harness's own quote units. Nothing float decides an order, and
// there is no clock, no environment and no file outside the repository: the same bars always answer
// the same orders, which is what the byte-for-byte replay check needs.

import { BPS, runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

/** Closes in the trend line: 60 one-minute bars is one hour. */
const TREND_BARS = 60;
/** Distance from the trend line that triggers a trade, in basis points. */
const BAND_BPS = 100n;
/** Fall from the best close since entry that sells regardless, in basis points. */
const HARD_STOP_BPS = 400n;
/** Slippage tolerance on every order: wide, so a thin minute still fills. */
const MAX_SLIPPAGE_BPS = 10_000;
/** The universe is one symbol. */
const SYMBOL = 'CBBTC';

/** Every close seen so far, oldest first. */
const closes: bigint[] = [];
/** Best close since the current position opened; null while flat. */
let peak: bigint | null = null;

/** Mean of the last `n` closes, truncated; null until there are `n` of them. */
function trendLine(n: number): bigint | null {
  if (closes.length < n) return null;
  let sum = 0n;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i];
  return sum / BigInt(n);
}

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    // Warm-up batches only build history; any order on one is rejected by the harness.
    if (state.warmingUp) return [];

    const trend = trendLine(TREND_BARS);
    const held = state.positions.get(SYMBOL);

    // Holding: sell the whole position on the first exit signal, else do nothing.
    if (held !== undefined && held.qty > 0n) {
      if (peak === null || close > peak) peak = close;
      const belowBand = trend !== null && close * BPS < trend * (BPS - BAND_BPS);
      const stopped = close * BPS < peak * (BPS - HARD_STOP_BPS);
      if (!belowBand && !stopped) return [];
      peak = null;
      return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    // Flat: buy all the cash the weight cap allows, but only on a breakout above the band.
    peak = null;
    if (trend === null) return [];
    if (close * BPS <= trend * (BPS + BAND_BPS)) return [];

    const capRoom = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
    const notional = state.cash < capRoom ? state.cash : capRoom;
    if (notional <= 0n || notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];

    peak = close;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
