// Test rate limiter functionality
const gpt4oRateLimiter = {
  requests: new Map(),
  maxRequests: 2,
  
  canMakeRequest: function() {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    for (const [timestamp] of this.requests) {
      if (timestamp < minuteAgo) {
        this.requests.delete(timestamp);
      }
    }
    
    const recentRequests = Array.from(this.requests.keys())
      .filter(timestamp => timestamp > minuteAgo).length;
    
    return recentRequests < this.maxRequests;
  },
  
  addRequest: function() {
    const now = Date.now();
    this.requests.set(now, true);
  },
  
  getTimeUntilReset: function() {
    const now = Date.now();
    const oldestRequest = Math.min(...Array.from(this.requests.keys()));
    const timeElapsed = now - oldestRequest;
    const timeRemaining = 60000 - timeElapsed;
    return Math.max(0, Math.ceil(timeRemaining / 1000));
  }
};

function testRateLimiter() {
  console.log('🧪 Testing Rate Limiter...\n');
  
  console.log('Initial state:', gpt4oRateLimiter.canMakeRequest());
  
  gpt4oRateLimiter.addRequest();
  console.log('After 1 request:', gpt4oRateLimiter.canMakeRequest());
  
  gpt4oRateLimiter.addRequest();
  console.log('After 2 requests:', gpt4oRateLimiter.canMakeRequest());
  
  gpt4oRateLimiter.addRequest();
  console.log('After 3 requests:', gpt4oRateLimiter.canMakeRequest());
  
  console.log('Time until reset:', gpt4oRateLimiter.getTimeUntilReset(), 'seconds');
  
  console.log('✅ Rate limiter test completed!');
}

testRateLimiter(); 