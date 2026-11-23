// cbBTC trend rail: long while the price holds above its own moving average.
//
// The round trip costs about 26 bps (fee + slippage + impact) and cash earns nothing, so the bot does
// not try to scalp a one-minute bar: it holds the asset while the trend is up and stands aside when it
// is not. The trend is the mean of the last TREND_BARS closes. A band of BAND_BPS either side of that
// mean is the hysteresis that keeps it from churning on a price that sits on the line: it buys only
// when the close is BAND_BPS above the mean, and sells only when the close is BAND_BPS below it.
// On top of that, a HARD_STOP_BPS fall from the best close since entry sells regardless.
//
// All arithmetic is integer bigint on the harness's own quote units. No clock, no files outside the
// repository, no network: the same bars always answer the same orders.

import { BPS, runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

/** Closes averaged for the trend line: 60 one-minute bars is an hour. */
const TREND_BARS = 60;
/** How far from the trend line the close must sit before the bot acts, in basis points. */
const BAND_BPS = 100n;
/** A fall this far below the best close since entry sells the position, in basis points. */
const HARD_STOP_BPS = 400n;
/** Slippage tolerance on every order: wide, so a thin minute still fills. */
const MAX_SLIPPAGE_BPS = 10_000;
/** The one symbol traded: the universe is CBBTC alone. */
const SYMBOL = 'CBBTC';

/** Every close seen so far, oldest first. */
const closes: bigint[] = [];
/** The best close since the current position was opened; null while flat. */
let peak: bigint | null = null;

/** The mean of the last `n` closes, truncated; null until there are `n` of them. */
function trendLine(n: number): bigint | null {
  if (closes.length < n) return null;
  let sum = 0n;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i];
  return sum / BigInt(n);
}

await runBars({
  onBatch(state: BarsState) {
    const close = state.close(SYMBOL);
    if (close !== null) closes.push(close);
    if (state.warmingUp || close === null) return [];

    const held = state.positions.get(SYMBOL);
    const trend = trendLine(TREND_BARS);

    if (held !== undefined && held.qty > 0n) {
      if (peak === null || close > peak) peak = close;
      const belowBand = trend !== null && close * BPS < trend * (BPS - BAND_BPS);
      const stopped = close * BPS < peak * (BPS - HARD_STOP_BPS);
      if (belowBand || stopped) {
        peak = null;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }] as OrderInput[];
      }
      return [];
    }

    peak = null;
    if (trend === null) return [];
    if (close * BPS <= trend * (BPS + BAND_BPS)) return [];

    const { caps, fees } = state.hello;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const notional = state.cash < byWeight ? state.cash : byWeight;
    if (notional <= 0n || notional < BigInt(fees.min_notional_quote_units)) return [];
    peak = close;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }] as OrderInput[];
  },
});
