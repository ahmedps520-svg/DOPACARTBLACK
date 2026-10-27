# DOPACART economy model

Everything in DOPACART is fictional: products, brands, credits (CR) and deliveries. This document describes the rules the simulation follows. The source of truth is `src/engine/`. Tuning constants are in `src/engine/constants.ts`.

## Clock

| Item | Value |
| --- | --- |
| Tick | 10 in-game minutes |
| Real time per tick at 1× | 5 seconds (1 in-game day ≈ 12 real minutes) |
| Speeds | Pause, 1×, 2×, 4× |
| Pre-game history | 30 in-game days are simulated before a new game starts, so every chart begins with recorded data |
| Offline catch-up | Missed ticks are simulated when you return, capped at 7 in-game days |

Every time-based system runs inside `gameTick` (`src/engine/sim.ts`) in this order: releases → events → prices → deliveries → store customers → hourly rivals and snapshots → alerts → midnight rollover (cash-flow streak, operating costs, daily snapshot, daily challenges) → mission and achievement checks.

## Price model (`src/engine/market.ts`)

Each product has a base price `B`, a current price `P`, a demand index `D` (100 means normal), a market supply `S`, a normal supply level `S_ref`, a volatility `σ` and a production cost.

**Fair value**

```
F = B · (D / 100)^0.8 · clamp((S_ref / S)^β, 0.55, 2.4)
```

`β` is the supply elasticity. It rises with rarity: common 0.25, uncommon 0.3, rare 0.4, epic 0.5, legendary 0.6, exclusive 0.7.

**Price**

```
x' = x + 2.5·dt·(ln F − x) + σ·m·√dt·Z
```

- `x` is the log of the price.
- `dt` is one tick in days (1/144).
- `Z` is a standard normal draw.
- `m` is the volatility multiplier from active events.

Three guards apply:

- A single tick can move the log price by at most ±5%.
- The price never falls below `max(0.3·B, 0.85·production cost)`.
- The price never rises above `B` times a rarity ceiling: ×3 for common, up to ×10 for exclusive.

**Demand**

```
D' = D + 0.9·dt·(D_target − D) + 0.14·clamp(σ_eff / 0.06, 0.45, 2.2)·√dt·Z·D
```

- `D_target = demandBase × event demand multipliers × scenario multiplier`.
- Demand noise scales with volatility, so staples stay calm while collectibles swing.

**Supply (regular products)**

```
S' = S + r·dt·(S_eq − S) + noise,  where S_eq = S_ref · event supply multiplier · √(100 / D)
```

`r` is the restock rate. It is 1.6 per day for commons and falls to 0.15 per day for exclusives.

**Supply (limited editions)**

Limited editions never restock:

- Collectors take units off the market at a rate proportional to supply and demand.
- When the price exceeds 1.25× base, holders release units back.
- Shortage events pull additional units.

**Trades by the player and rivals**

- Buying reduces `S`, which raises the fair value.
- Selling to the market increases `S`.

**Volume and popularity**

Simulated market volume per tick is a Poisson draw with mean `0.6·S_ref·(D/100)` per day. Player and rival trades add to that volume.

## Market events (`src/engine/events.ts`)

Random events fire about 1.3 times per in-game day. At most 4 random events can be active at once, and the same event type cannot run twice at the same time. The scenario sets how likely bullish and bearish events are.

| Event | Targets | Rules applied while active |
| --- | --- | --- |
| Electronics demand surge | Electronics | Demand ×1.35 |
| Sneaker collector frenzy | Sneakers | Demand ×1.6, volatility ×1.5 |
| Supplier shipment delay | Random category | Supply equilibrium ×0.55, supplier delivery time ×1.6 |
| Unexpected inventory surplus | Random non-luxury category | Supply +60% immediately, supply equilibrium ×1.4 |
| Collectible market crash | Collectibles and limited editions | Demand ×0.6, volatility ×1.8 |
| Gaming tournament | Consoles and peripherals | Demand ×1.4 |
| Creator spotlight | One product | Demand ×2 |
| Limited release sells out | One limited edition | Supply −50% immediately, demand ×1.3 |
| Fashion week | Fashion | Demand ×1.3 |
| Logistics strike | All products | Delivery time ×1.5, supply ×0.85 |
| Luxury boom | Luxury | Demand ×1.3 |
| Quality concerns | One electronics or gaming product | Demand ×0.55 |
| Chip shortage | Components, consoles, laptops | Supply ×0.5 |
| Home goods lull | Furniture and home | Demand ×0.75 |
| Electronics slump | Electronics | Demand ×0.78 |
| Holiday season (calendar, every 30 days) | All products | Demand ×1.2, store visitors ×1.5 |
| Fitness rush (calendar, every 30 days) | Fitness | Demand ×1.5 |

**Releases and successors**

Products with a release day are listed at 09:00 on that day. The new product gets a launch window of demand ×1.3 for 2 days.

If the new product is a successor to an older model, a second event is published. It permanently lowers the older model's long-run demand baseline by 20% and adds a 15% demand dip for 2 days.

**Combined effects**

When several events overlap, their multipliers stack within these bounds:

| Multiplier | Range |
| --- | --- |
| Demand | 0.35–2.4 |
| Supply | 0.3–2 |
| Volatility | 0.5–2.5 |

**Market wraps**

Market wraps are daily newsroom summaries built from recorded prices and volume. They do not change the economy.

## Buying and selling

| Action | Price | Fees |
| --- | --- | --- |
| Market buy | Current price × quantity; filled instantly | None |
| Market sell | Bid = price × (1 − spread) | Marketplace fee 4%, lowered to 3%, 2% and 1.25% by Trusted Seller |
| Store sale | Your listing price | 2.5% payment fee |

Spreads by rarity: common 3%, uncommon 3.5%, rare 4%, epic 5%, legendary 6%, exclusive 7%.

**Validation**

- Every trade is checked against cash, available supply, warehouse capacity (goods in transit included), the rarity's unlock level and free units.
- Free units are units owned and not reserved by a listing.

**Costing and profit**

- Inventory uses weighted-average cost. Freight on a supplier order is spread across its units.
- Realized profit = proceeds − fees − cost basis.
- Unrealized profit = market value of unsold stock − its cost. It is never counted as cash.

## Stores (`src/engine/storefront.ts`)

Expected units sold per in-game day for one listing:

```
λ = traffic × conversion × attractiveness × (D / 100) / (1 + 0.08·(active listings − 1))
```

| Term | Definition |
| --- | --- |
| traffic | 26 visitors × Storefront Visibility × reputation (1 + log₁₀(1 + units sold) / 3, capped at ×2) × scenario × events |
| conversion | Rarity base rate (8.5% common down to 1.6% exclusive) × Studio Photography |
| attractiveness | exp(−4.5 × (listing price / market price − 1)), clamped to 0.03–3 |

**Pricing**

- A listing price must be between 50% and 175% of the market price when you set it.

**Selling and operating costs**

- Units sold in a tick are a Poisson draw, capped at the units listed.
- An open store pays a daily operating cost at midnight: 60, 110, 180 or 260 CR for stores #1–#4, reduced by Lean Operations.
- If you can't pay, the store closes.
- A closed store neither sells nor pays.

## Suppliers and deliveries (`src/engine/suppliers.ts`, `src/engine/orders.ts`)

**Supplier terms**

Suppliers differ on:

- Price (60–84% of market)
- Delivery time (6 hours to 3 days)
- On-time reliability (72–99%)
- Minimum order per line
- Daily capacity
- Freight charge
- Highest rarity they can source
- Unlock level

**Discounts**

- Volume discounts are −4% at 3× the minimum order and −8% at 8×.
- Each supplier has one deterministic daily special offer at −12%.

**Delivery time**

- Planned delivery time = supplier days × Express Logistics multiplier × the strongest active delivery-event multiplier.
- With probability 1 − reliability, an order picks up a hidden delay of 25–75% of the planned time. The delay is revealed when the order ships.

**Delivery schedule**

The order status follows the in-game clock:

| Status | When |
| --- | --- |
| Placed | When ordered |
| Processing | 8% of the planned time |
| Packed | 25% |
| Shipped | 40% |
| Out for delivery | 85% + delay |
| Delivered | 100% + delay |

Inventory is added only when the order reaches Delivered. Missed ticks run the same schedule, so an order that comes due while the game is closed is delivered on your return.

**Cancellation**

| Status | Refund |
| --- | --- |
| Placed or processing | Full refund, freight included |
| Packed or shipped | 85% of goods; the restocking fee and freight are lost and booked as operating expense |
| Out for delivery or delivered | Cannot be cancelled |

## Progression (`src/engine/progression.ts`)

**Levels**

- XP needed for level `L` is `round(50·(L−1)^1.75)`, up to level 50.
- Titles: Beginner (1), Reseller (5), Store Owner (10), Market Specialist (20), Business Mogul (35), Market Legend (50).

**XP sources**

| Source | XP |
| --- | --- |
| Profitable sale | profit / 8 × rarity multiplier, capped at 250 per sale |
| Supplier delivery | 15 |
| Upgrade | 30 |
| Missions, daily challenges, achievements, tutorial | Fixed amounts |

- Purchases and clicking give no XP.
- Leveling up never pays credits.

**Rewards**

Mission and daily-challenge credit rewards are small. They go through the ledger as `reward` transactions and are paid only after the engine re-checks the condition.

**Level gates**

Levels gate:

- Rarity purchases: rare at 3, epic at 8, legendary at 15, exclusive at 25.
- Suppliers.
- Upgrade tiers.
- Store themes.
- Extra stores: levels 10, 20 and 35.

## Rival businesses (`src/engine/competitors.ts`)

There are five simulated rivals. All are clearly labelled and none are real players. They start on Day 1 with cash only and act every in-game hour:

- **Value Hunter:** buys at 7% or more below the 7-day average. Sells at +8% or −12%.
- **Momentum Trader:** buys after a 24-hour rise of 4% or more. Sells on negative momentum, at +12% or at −8%.
- **Collector:** buys rare-or-better items at or below the 7-day average. Sells at +25%.
- **Event Chaser:** buys in the first 6 hours of a bullish event. Sells at +15%, at −10% or when the event ends.
- **Volume Dealer:** buys commons at or below base value and sells 6% of its stock per hour through its storefront.

Rival purchases and market sales change real market supply. Their storefront sales do not.

## Integrity

- Commands (`src/engine/commands.ts`) run inside an immer draft. If any step fails, the draft is discarded, so a multi-line checkout is all-or-nothing.
- Commands that move money take an idempotency key. A repeated key is rejected.
- The UI also locks buttons for a moment after a click.
- `recordTx` (`src/engine/ledger.ts`) is the only place cash changes. It rejects negative balances and keeps the wallet totals.
- The test suite checks after random play that cash always equals the sum of all transactions.
- Only one browser tab can run a save at a time. Another tab must take over explicitly.
