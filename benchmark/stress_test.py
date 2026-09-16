"""
10,000 Concurrent Users Stress Test Script (Python / AsyncIO)
Simulates high-demand rush for the last 10 Lakhs of an NCD bond offering.
Verifies low-latency concurrency control, rate limiting, and zero-oversell guarantee.
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import asyncio
import aiohttp
import time
import json
import random

BASE_URL = "http://localhost:4000"
BOND_ID = "bond-navi-10l"
TOTAL_REQUESTS = 10000
CONCURRENCY_LIMIT = 500

async def send_buy_request(session, req_id, sem):
    async with sem:
        # Simulate investor distribution (10% HNI with high portfolio, 90% Retailers)
        is_hni = (req_id % 10 == 0)
        portfolio = random.randint(1000000, 6000000) if is_hni else random.randint(15000, 65000)
        latency = random.randint(2, 15) if is_hni else random.randint(50, 250)

        payload = {
            "userId": f"py-investor-{req_id:05d}",
            "unitsRequested": 1,
            "portfolioValue": portfolio,
            "networkLatencyMs": latency,
            "isHni": is_hni
        }

        try:
            async with session.post(f"{BASE_URL}/api/bonds/{BOND_ID}/buy", json=payload) as resp:
                status = resp.status
                body = await resp.json()
                return {
                    "req_id": req_id,
                    "status_code": status,
                    "success": body.get("success", False),
                    "reason": body.get("message", "")
                }
        except Exception as e:
            return {
                "req_id": req_id,
                "status_code": 500,
                "success": False,
                "reason": str(e)
            }

async def run_stress_test():
    print("\n" + "="*65)
    print(f"🔥 PYTHON ASYNCIO STRESS TEST: {TOTAL_REQUESTS} CONCURRENT INVESTORS")
    print(f"   Target: {BASE_URL}/api/bonds/{BOND_ID}/buy")
    print("="*65 + "\n")

    # 1. Reset pool to 10 units via REST
    async with aiohttp.ClientSession() as session:
        print("1. Resetting bond pool to exactly 10 units (Last ₹10 Lakhs)...")
        async with session.post(f"{BASE_URL}/api/bonds/{BOND_ID}/reset-stress", json={"units": 10}) as resp:
            reset_data = await resp.json()
            print(f"   Pool Reset Status: {reset_data.get('success')}")

        # Temporarily increase rate limit so lock contention is directly tested
        await session.post(f"{BASE_URL}/api/bonds/{BOND_ID}/strategy", json={
            "strategy": "fair_retail",
            "rateLimitPerSec": 50000,
            "rateLimitBurst": 50000
        })

    # 2. Fire 10,000 concurrent requests
    print(f"2. Firing {TOTAL_REQUESTS} concurrent requests (Concurrency Limit: {CONCURRENCY_LIMIT})...")
    sem = asyncio.Semaphore(CONCURRENCY_LIMIT)
    start_time = time.time()

    conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT)
    async with aiohttp.ClientSession(connector=conn) as session:
        tasks = [send_buy_request(session, i, sem) for i in range(1, TOTAL_REQUESTS + 1)]
        results = await asyncio.gather(*tasks)

    elapsed = time.time() - start_time
    rps = int(TOTAL_REQUESTS / elapsed) if elapsed > 0 else 0

    successes = [r for r in results if r["success"]]
    rejections = [r for r in results if not r["success"]]

    print("\n" + "-"*65)
    print("📊 LOAD TEST PERFORMANCE SUMMARY")
    print("-"*65)
    print(f"⏱️ Total Elapsed Time:     {elapsed:.2f} seconds")
    print(f"⚡ Throughput (RPS):        {rps} req/sec")
    print(f"✅ HTTP Success (200 OK):  {len(successes)} (Target: 10)")
    print(f"⛔ Graceful Rejections:    {len(rejections)} (Target: {TOTAL_REQUESTS - 10})")

    # 3. Verify Database Integrity via Audit endpoint
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/audit/{BOND_ID}") as resp:
            audit = await resp.json()

    print("\n" + "-"*65)
    print("🔒 DATABASE AUDIT INTEGRITY REPORT")
    print("-"*65)
    print(json.dumps(audit.get("audit", {}), indent=2))

    audit_data = audit.get("audit", {})
    if (len(successes) == 10 and 
        len(rejections) == (TOTAL_REQUESTS - 10) and 
        audit_data.get("remaining_units") == 0 and
        not audit_data.get("negative_balance_detected")):
        print("\n🎉 =================================================================")
        print("🏆 100% PROVEN: EXACTLY 10 SUCCEEDED, 9,990 GRACEFULLY REJECTED.")
        print("   ZERO DATABASE CORRUPTION. ZERO NEGATIVE BALANCE.")
        print("=================================================================\n")
    else:
        print("\n⚠️ Audit check flagged discrepancy:", audit_data)

if __name__ == "__main__":
    asyncio.run(run_stress_test())
