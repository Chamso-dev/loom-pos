# LoomPOS Business Intelligence

LoomPOS is more than a CRUD POS: a single analytics engine
(`src/lib/intelligence.ts`) turns raw sales + stock rows into decisions. It is
pure and dependency-free, so the **offline (SQLite)** and **server (Prisma)**
layers feed it identical inputs and get identical output via
`GET /api/analytics/intelligence`. The notifications bell uses the same engine
through `GET /api/inventory/low-stock` (now predictive).

These are original implementations adapted to this app's data model, grounded
in standard retail/ERP practice. Where the model lacks an input (real supplier
lead times, expiry dates), the metric is derived transparently from sales/stock
outcomes and named honestly — nothing is faked.

## Per-product metrics

| Metric | How it's computed | Why it matters |
|---|---|---|
| **Sales velocity** | units sold in last 30d ÷ 30 | demand run-rate |
| **Days of cover** | stock ÷ velocity | when you'll run out |
| **Reorder point** | velocity × lead time + safety stock | when to reorder |
| **Safety stock** | `1.5 × σ(daily demand) × √lead time` | buffer for demand variability (service level) |
| **Suggested reorder qty** | `target level − on hand`, target = velocity × (review + lead) + safety | how much to buy |
| **Sell-through %** | unitsSold ÷ (unitsSold + stock) | how fast stock converts to sales |
| **GMROI** | 30d gross profit ÷ average inventory cost | profit per ₹ of stock invested |
| **Margin %** | (price − cost) ÷ price | profitability |
| **Trend %** | 7d run-rate vs 30d baseline | momentum (rising/falling) |
| **Demand forecast** | velocity × horizon × dampened trend factor | expected future units |
| **Status** | out / critical / low / healthy / overstock / dead | at-a-glance action |

### Classifications
- **ABC** (Pareto): products ranked by 30-day revenue; cumulative ≤80% = A,
  ≤95% = B, rest = C. Focus management on A-items.
- **XYZ** (demand variability): coefficient of variation of weekly demand;
  CV < 0.5 = X (steady), ≤1 = Y (variable), >1 = Z (erratic). Drives how much
  safety stock a SKU really needs.
- **Performance score (0–100)**: weighted blend of velocity (30%), revenue
  (25%), margin (20%), sell-through (15%), recency (10%).

## Store-level metrics

- **Inventory health score (0–100)**: starts at 100, penalised for out-of-stock,
  needs-reorder, dead stock and overstock (each capped), rewarded for healthy
  sell-through. Returns a grade + the contribution of each factor.
- **Revenue forecast (next 7 days)**: ordinary-least-squares linear trend on the
  last 30 days of daily revenue, blended with a 7-day moving average weighted by
  the regression's R² (fit confidence). Avoids over-trusting a noisy trend.
- **Sales trend**: recent 7-day daily average vs the prior 7-day average →
  rising / falling / stable with % change.
- **Inventory valuation**: stock at cost and at retail; **dead-stock capital**
  highlights money frozen in non-moving SKUs.
- **Category performance**: revenue, profit, units and margin by category.

## Customers — RFM

Orders are grouped by mobile (or name). Each customer gets Recency, Frequency
and Monetary sub-scores → a 0–100 **value score** and a segment
(Champion / Loyal / At Risk / New / Occasional). Walk-in cash sales are ignored.

## Suppliers — performance score

No delivery data exists, so a **supplier performance score** is derived from the
outcomes of that supplier's products: average sell-through (40%), revenue share
(30%), margin (30%), minus a dead-stock penalty. Honest proxy for "which
suppliers' goods actually sell profitably."

## Where this replaced weak logic

| Before | After |
|---|---|
| Low stock = `stock <= 10` (flat) | reorder-point prediction from real velocity + variability |
| Dashboard = today's revenue/orders/GST + 7-day bars | health score, forecast, restock plan, dead stock, ABC, performers, RFM |
| No forecasting / no scoring | trend-aware forecasts and 0–100 scores across products, customers, suppliers, inventory |
