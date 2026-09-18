# NCD Concurrency Engine & Allocation Simulator

> High-concurrency NCD (Non-Convertible Debentures) IPO bond allocation engine engineered with atomic CAS inventory control, dynamic token bucket rate limiting, SEBI-aligned fair retail queueing, and sub millisecond audit verification.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-ncd--simulation.vercel.app-blue?style=for-the-badge&logo=vercel)](https://ncd-simulation.vercel.app/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB?style=for-the-badge&logo=react)](https://ncd-simulation.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%2022%20%7C%20Express-339933?style=for-the-badge&logo=node.js)](https://render.com/)
[![Database](https://img.shields.io/badge/Database-SQLite%20Sync%20WAL-003B57?style=for-the-badge&logo=sqlite)](https://nodejs.org/api/sqlite.html)

🔗 **Live Application URL:** [https://ncd-simulation.vercel.app/](https://ncd-simulation.vercel.app/)

---

## Issue??? :- The "Last ₹10 Lakhs Rush"

During high yield corporate NCD offerings , bond issues often oversubscribe within minutes. In the final phase such as the **last ₹10 Lakhs pool**—thousands of investors submit simultaneous purchase orders.

Traditional systems encounter two catastrophic failure modes:
1. **Overselling / Negative Balances:** Race conditions lead to overselling units beyond statutory issuance limits, triggering regulatory non-compliance and expensive settlement reversals.
2. **Network Advantage / Front-Running:** High-Net-Worth Individuals (HNIs) with co-located servers and institutional fiber low-latency connections front-run retail investors on 4G/5G mobile connections, violating fair retail allotment principles.

This engine demonstrates a resilient architecture that solves both problems simultaneously: **absolute zero-margin allocation error** combined with **anti-front-running fairness heuristics**.

---

## Initial features :-

- ** Dynamic Concurrency Strategy Switching:** The issuer can switch the allocation algorithm live on active traffic without restarting the server and allow concurrent users on basis of Portfolio Profit. 
- **Zero Margin Error Guarantee:** Strict atomic Compare-And-Swap (CAS) inventory deduction with SQLite WAL mode. Even under 10,000 concurrent requests, exactly zero units are oversold.
- **SEBI-Aligned Fair Retail Allocation:** Dynamic prioritization algorithm weighting retail investors, compensating for mobile latency jitter, and preventing HNI predatory queue jumps.
- **Token Bucket Rate Limiting:** Per-bond adaptive leaky/token bucket rate limiters protecting against traffic spikes and DDoS surges with immediate `429 Too Many Requests` shedding.
- **Full-Duplex WebSockets:** Real-time push stream for live bond book updates, terminal concurrency event logs, and continuous allocation metric ticks.
- **Cryptographic Audit Ledger:** Real-time SHA-256 transaction hash generation with continuous mathematical reconciliation (`units_sold + remaining_units == total_units`).
- **In-Browser 10k Stress Test Visualizer:** Trigger and observe concurrent load simulations in real-time with visual graphs, latency distributions, and throughput (RPS) meters. You can change the number of concurrent users accordingly while viewing the number of success and failed lock allocation.

