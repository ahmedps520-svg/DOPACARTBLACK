# DOPACART: BLACK MARKET

**Buy smart. Sell higher. Build an empire.**

**Play it live:** https://dopacart-black-market.onrender.com

DOPACART is a single-player shopping and business simulation game that looks like a premium e-commerce site. You start with virtual credits, buy fictional products, source stock from suppliers, run your own stores and trade a market whose prices actually move.

> Everything in DOPACART is fictional. Every product, brand, price, store, supplier and delivery is made up, and credits (CR) are virtual game currency with no real-world value. The game never processes real purchases and never ships anything.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine test suite (vitest)
npm run build      # type-check + production build into dist/
```

The build is a static site with relative paths and a hash router, so you can host `dist/` anywhere.

**Deployment:**

- **Render.** A Render static site builds every push to `main` (`npm ci && npm run build`, publishing `dist/`) and serves it at https://dopacart-black-market.onrender.com.
- **gh-pages branch.** `.github/workflows/deploy.yml` also publishes `dist/` to the `gh-pages` branch, so turning on GitHub Pages (Settings → Pages → Deploy from branch `gh-pages`) would serve the same build at https://ahmedps520-svg.github.io/DOPACARTBLACK/.
- **Pull requests.** Every PR runs the tests and the production build (`.github/workflows/ci.yml`).

## Core loop

**Discover products → buy inventory → track market prices → sell for profit → expand your business → build an empire.**

1. Browse the **Market**: 126 fictional products in 5 categories and 27 subcategories, each drawn as a studio-lit SVG render.
2. **Buy** at the live price for instant delivery, or order wholesale from **Suppliers** for 16–40% off and wait for delivery.
3. **Sell**:
   - instantly to the market (bid price minus the spread and a fee), or
   - through your **Store**, at your own price, to simulated customers over time.
4. Read the **Trading Floor** and the **Newsroom**. Events change demand, supply, volatility and delivery times by published rules.
5. Reinvest in **upgrades** and level up. Unlock rarer products, better suppliers, more stores and new themes.

## Features by stage

| Stage | Status |
| --- | --- |
| **1 · Playable shopping simulator**: premium storefront, catalog, product detail pages, search, filters and sorting, compare, favorites, cart, purchasing, inventory, selling, wallet with full transaction history, saved progress | ✅ |
| **2 · Economic simulation**: supply/demand price model, 30 days of pre-simulated history, 17 rule-based market events, product releases with successor pressure, Trading Floor (1H/1D/1W/1M/ALL charts, up to 4 overlaid products, watchlist, price alerts) | ✅ |
| **3 · Business management**: store builder (name, logo upload, theme, categories, listings, price limits, demand forecasts), 9 upgrades with real effects, 7 suppliers, delivery tracking with refund rules, analytics with warnings and advisory recommendations, missions, daily challenges, achievements, 50 levels | ✅ |
| **4 · Advanced**: 5 simulated rivals with published strategies that trade on the same market, leaderboard, up to 4 stores, storefront preview, downloadable share cards, 4 market scenarios, collection view | ✅ |
| **4 · Multiplayer**: shared server economy, friends, player-to-player trading, reporting and blocking | ❌ Not built. The spec allows a single-player release with simulated competitors, so these features are left out rather than added as non-working buttons. |

Other systems:

- **Interactive tutorial.** 8 steps run on the real systems: each step completes only when you actually buy, sell, open the page or purchase the upgrade. You can skip it or restart it.
- **Settings:**
  - Sound effects and generative music, made with Web Audio.
  - 3 themes and 3 accent colours.
  - Animations off and reduced motion.
  - English or Spanish UI.
  - Per-type notification toggles.
  - Privacy toggles.
  - Market speed and fast-forward.
  - Save export and import.
  - Reset, which requires typing RESET.
- **Responsive layout.** Desktop gets a sidebar, tablet an icon rail, and mobile a bottom navigation bar with a drawer.

## Economic integrity

- **One way to change cash.** `recordTx` (`src/engine/ledger.ts`) validates the balance, applies the change, updates wallet totals and writes an audited transaction: ID, time, type, product, quantity, unit price, total and resulting balance.
- **Atomic commands.** Every player action is a command (`src/engine/commands.ts`) run in an immer draft. Validation, pricing, state changes and ledger entries either all apply or nothing does. A multi-product checkout cannot partly succeed.
- **No double charges.** Money-moving commands carry idempotency keys and buttons briefly lock after a click. A double click or a retry cannot buy twice. Only one browser tab can run a save at a time.
- **Separate books.** The game keeps these records apart:
  - cash
  - inventory acquisition cost
  - current inventory value
  - revenue
  - selling fees
  - operating expenses
  - investments
  - realized profit
  - unrealized profit or loss
- **Honest charts.** Every chart and analytics figure is drawn from stored ticks, hourly and daily closes, hourly snapshots or the ledger.

The full rules are in [`docs/ECONOMY.md`](docs/ECONOMY.md).

## Architecture

```
src/
  engine/           Pure TypeScript simulation, no React
    types.ts          State and catalog types
    constants.ts      Tuning
    catalog.ts        126 fictional product definitions
    categories.ts
    market.ts         Price, demand and supply model
    history.ts        Compact price history and time ranges
    events.ts         Event rules, releases, market wraps
    ledger.ts         Central transaction system
    commands.ts       Validated, atomic, idempotent player commands
    orders.ts         Supplier orders and the delivery state machine
    storefront.ts     Stores, listings, simulated customers, operating costs
    suppliers.ts  upgrades.ts  progression.ts  alerts.ts  competitors.ts  tutorial.ts
    sim.ts            Tick loop and offline catch-up
    newGame.ts        New game setup and 30-day pre-game history
    __tests__/        vitest suite
  state/            zustand store, IndexedDB persistence, structural sharing
  art/              <ProductArt/>: 41 kinds of studio-lit SVG renders
  components/       Layout, charts, product cards, modals, tutorial coach
  pages/            One file per screen
  audio/  i18n/  lib/  styles/
```

**Persistence**

- The whole game state is saved to IndexedDB, with a localStorage fallback.
- Saves happen after every command and every few ticks, and again when the page is hidden.
- On return, missed in-game time is simulated, up to 7 in-game days. A "while you were away" report shows deliveries, store sales and cash changes.

**Server-side validation**

- This release runs entirely in the browser, which the spec accepts for single-player play.
- The engine has no React or DOM dependencies, so the same commands could run on a server for an authoritative multiplayer economy later.

## Testing

`npm test` runs the engine suite. It covers:

- Ledger invariants under random play.
- Purchase validation: funds, supply, capacity, rarity locks.
- Duplicate-request rejection and atomic cart checkout.
- Sale math: spread, fees, realized profit.
- Units reserved by store listings.
- Price bounds and the per-tick move limit.
- Event multipliers.
- Supplier delivery timing.
- Cancellation refunds.
- Store sales accounting.
- Upgrades.
- Alerts.
- Mission claims.
- The offline catch-up cap.

The dev-only route `#/dev/art` shows every product illustration.
