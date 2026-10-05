# SynthEPEL-R75 v2.0 — Tick Research Bot

Research-only bot for Deriv R_75 / Volatility 75. It uses the live tick stream and measures short Rise/Fall horizons in **ticks**, not minutes.

## Horizons tested simultaneously
- 3 ticks
- 5 ticks
- 7 ticks
- 10 ticks
- 15 ticks

One signal is evaluated at each configured signal interval, and the same signal is scored independently at every horizon. This lets us discover whether a short expiry contains more information than a longer one.

## Safety
- No contract purchases.
- No martingale/recovery.
- $1 is nominal only for P/L calculations.
- Demo/research use only.

## EPEL
EPEL is calculated from outcomes settled before the signal for the same direction and horizon. Minimum sample count is 50 and the probability gate uses a 95% Wilson lower bound. With a 78% assumed gross payout and lambda 0.50, the EPEL threshold is approximately 71.94%.

## Candidate signal
The initial candidate is intentionally simple: a 20-tick standardized displacement. Large negative displacement produces CALL; large positive displacement produces PUT. This is a research seed, not a claimed edge.

## Important statistical note
Signals overlap in time, so observations are not independent. The resulting ledger must therefore be analysed with time-ordered/walk-forward methods rather than treating every row as an independent bet.
