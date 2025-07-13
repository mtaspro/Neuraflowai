# 🤖 NEURAFLOW Bot Rate Limits

This document outlines the rate limiting system for different AI models used in the NEURAFLOW WhatsApp bot.

## 📊 Rate Limit Overview

| Model | Command | Rate Limit | Purpose |
|-------|---------|------------|---------|
| **LLaMA 3 8B 8192** | `@n [question]` (groups) | 5 requests/minute | Normal chatting |
| **Qwen3-235B** | `/ben [question]` | 20 requests/minute | General responses |
| **DeepSeek** | `/think [question]` | 15 requests/minute | Reasoning & analysis |
| **Qwen3-235B** | `/summary [text]` | 15 requests/minute | Text summarization |

## 🦙 LLaMA 3 8B 8192 (Groq)

**Rate Limit:** 5 requests per minute
**Usage:** Normal chatting in groups with `@n [question]`

### Status Check
```
/llamastatus
```

### Rate Limit Message
When limit is reached:
```
⏰ LLaMA 3 8B 8192 limit reached! Please wait for X seconds before trying again.

5 requests per minute. You can make another request in X seconds.
```

## 🤖 Qwen3-235B (OpenRouter)

**Rate Limit:** 20 requests per minute
**Usage:** `/ben [question]`

### Status Check
```
/statusben
```

### Rate Limit Message
When limit is reached:
```
⏰ Qwen API limit reached! Please wait for X seconds before trying again.

20 requests per minute. You can make another request in X seconds.
```

## 🧠 DeepSeek (OpenRouter)

**Rate Limit:** 15 requests per minute
**Usage:** `/think [question]`

### Status Check
```
/thinkstatus
```

### Rate Limit Message
When limit is reached:
```
⏰ DeepSeek reasoning limit reached! Please wait for X seconds before trying again.

15 requests per minute. You can make another request in X seconds.
```

## 📝 Summary (Qwen3-235B)

**Rate Limit:** 15 requests per minute
**Usage:** `/summary [text]`

### Status Check
```
/summarystatus
```

### Rate Limit Message
When limit is reached:
```
⏰ Summary API limit reached! Please wait for X seconds before trying again.

15 requests per minute. You can make another request in X seconds.
```

## 🔧 Technical Implementation

### Rate Limiter Structure
```javascript
const modelRateLimiter = {
  requests: new Map(), // Track requests per minute
  maxRequests: X, // Allow X requests per minute
  
  canMakeRequest: function() {
    // Check if request can be made
  },
  
  addRequest: function() {
    // Add request to tracking
  },
  
  getTimeUntilReset: function() {
    // Calculate time until rate limit resets
  }
};
```

### Usage in Code
```javascript
// Check rate limit before making API call
if (!modelRateLimiter.canMakeRequest()) {
  const timeRemaining = modelRateLimiter.getTimeUntilReset();
  // Send rate limit message
  return;
}

// Add request to rate limiter
modelRateLimiter.addRequest();

// Make API call
const reply = await modelFunction(contextMessages);
```

## 🧪 Testing

### Test LLaMA Rate Limiter
```bash
node test-llama-rate-limiter.js
```

### Test Clear Command
```bash
node test-clear.js
```

## 📈 Rate Limit Strategy

1. **LLaMA 3 8B 8192 (5/min):** Most restrictive for normal chatting
2. **Qwen3-235B (20/min):** Generous for general responses
3. **DeepSeek (15/min):** Moderate for reasoning tasks
4. **Summary (15/min):** Moderate for summarization tasks

This ensures fair usage across all models while maintaining bot responsiveness. 