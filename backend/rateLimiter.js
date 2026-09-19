/**
 * Token Bucket & Leaky Bucket Rate Limiter
 * Implements high-throughput token bucket algorithm with nanosecond precision
 * and real-time telemetry metrics.
 */
class TokenBucketRateLimiter {
  constructor(options = {}) {
    this.rate = options.rate || 500; // tokens per second
    this.capacity = options.capacity || 1000; // max burst capacity
    this.tokens = this.capacity;
    this.lastRefill = process.hrtime.bigint();
    this.totalAllowed = 0;
    this.totalThrottled = 0;
  }

  /**
   * Refills tokens based on elapsed nanoseconds
   */
  refill() {
    const now = process.hrtime.bigint();
    const elapsedNs = Number(now - this.lastRefill);
    const elapsedSeconds = elapsedNs / 1e9;

    if (elapsedSeconds > 0) {
      const tokensToAdd = elapsedSeconds * this.rate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Attempts to consume N tokens.
   * @param {number} count - number of tokens to consume (default 1)
   * @returns {boolean} true if permitted, false if rate limited
   */
  tryConsume(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      this.totalAllowed += count;
      return {
        allowed: true,
        tokensRemaining: Math.floor(this.tokens),
        capacity: this.capacity
      };
    } else {
      this.totalThrottled += count;
      return {
        allowed: false,
        tokensRemaining: Math.floor(this.tokens),
        capacity: this.capacity,
        retryAfterMs: Math.ceil(((count - this.tokens) / this.rate) * 1000)
      };
    }
  }

  /**
   * Dynamic reconfiguration by Issuer
   */
  updateConfig(rate, capacity) {
    this.refill();
    const prevCapacity = this.capacity;
    this.rate = Number(rate) || this.rate;
    this.capacity = Number(capacity) || this.capacity;
    // If capacity was expanded (e.g. for benchmark or issuer adjustment), refill tokens
    if (this.capacity > prevCapacity) {
      this.tokens = this.capacity;
    } else {
      this.tokens = Math.min(this.tokens, this.capacity);
    }
  }

  getMetrics() {
    this.refill();
    return {
      availableTokens: Math.floor(this.tokens),
      capacity: this.capacity,
      ratePerSec: this.rate,
      fillPercentage: Math.min(100, Math.round((this.tokens / this.capacity) * 100)),
      totalAllowed: this.totalAllowed,
      totalThrottled: this.totalThrottled
    };
  }

  reset() {
    this.tokens = this.capacity;
    this.lastRefill = process.hrtime.bigint();
    this.totalAllowed = 0;
    this.totalThrottled = 0;
  }
}

// Registry to manage rate limiters per bond offering
class RateLimiterRegistry {
  constructor() {
    this.limiters = new Map();
  }

  getLimiter(bondId, defaultRate = 500, defaultCapacity = 1000) {
    if (!this.limiters.has(bondId)) {
      this.limiters.set(bondId, new TokenBucketRateLimiter({
        rate: defaultRate,
        capacity: defaultCapacity
      }));
    }
    return this.limiters.get(bondId);
  }

  updateLimiter(bondId, rate, capacity) {
    const limiter = this.getLimiter(bondId, rate, capacity);
    limiter.updateConfig(rate, capacity);
    return limiter.getMetrics();
  }

  resetLimiter(bondId) {
    this.getLimiter(bondId).reset();
  }
}

module.exports = {
  TokenBucketRateLimiter,
  rateLimiterRegistry: new RateLimiterRegistry()
};
