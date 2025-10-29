# Chrome Built-in AI Troubleshooting Guide

## Current Status Analysis

From your screenshot, I can see:
- ✅ Origin: `http://localhost:3000` (correct)
- ✅ Secure context: `true` (correct for localhost)
- ❌ AI APIs: Still not exposed by Chrome

## Solution Steps

### Step 1: Verify Chrome Version & Channel
You mentioned using Chrome Dev. Verify:
```
chrome://version/
```
Look for:
- Version: 128.0 or higher
- Channel: Dev or Canary (Stable may not have all features yet)

### Step 2: Enable ALL Required Flags

Go to each of these URLs and set to **Enabled** (or **Enabled BypassPerfRequirement** where available):

1. `chrome://flags/#prompt-api-for-gemini-nano`
2. `chrome://flags/#summarization-api-for-gemini-nano`
3. `chrome://flags/#writer-api-for-gemini-nano`
4. `chrome://flags/#rewriter-api-for-gemini-nano`
5. `chrome://flags/#optimization-guide-on-device-model`

### Step 3: The Critical Relaunch Sequence

This is the most commonly missed step:

1. After enabling flags, click **"Relaunch"** button
2. Wait for Chrome to fully restart
3. Close Chrome completely again
4. Reopen Chrome (this second restart is crucial!)
5. Navigate to `http://localhost:3000`

### Step 4: Verify Model Download

Check if Gemini Nano is downloaded:
```
chrome://components/
```

Look for "Optimization Guide On Device Model" and verify:
- Status should be: **"Up to date"** or **"Ready"**
- Version should show a number (e.g., `2025.6.30.1229`)

If it says "Not installed":
1. Click **"Check for update"**
2. Wait for download (4GB+ file, takes time)
3. Restart Chrome after download completes

### Step 5: Verify API Exposure in Console

Open DevTools Console on `http://localhost:3000` and run:

```javascript
console.log('window.ai exists:', !!window.ai);
console.log('window.LanguageModel exists:', !!window.LanguageModel);
console.log('Secure context:', window.isSecureContext);
```

Expected results if working:
- At least ONE of `window.ai` or `window.LanguageModel` should be `true`
- Secure context should be `true`

### Step 6: Test API Capabilities

If `window.ai` exists, test capabilities:

```javascript
(async () => {
  if (window.ai?.languageModel) {
    const caps = await window.ai.languageModel.capabilities();
    console.log('Language Model:', caps.available);
  }
  if (window.ai?.writer) {
    const caps = await window.ai.writer.capabilities();
    console.log('Writer:', caps.available);
  }
  if (window.ai?.summarizer) {
    const caps = await window.ai.summarizer.capabilities();
    console.log('Summarizer:', caps.available);
  }
})();
```

Expected: At least one should return `"readily"` or `"after-download"`

## Common Issues & Solutions

### Issue 1: "window.ai is undefined"
**Cause**: Flags not fully activated or browser not restarted properly
**Solution**: 
- Complete Step 3 (double restart)
- Try Chrome Canary instead of Dev
- Ensure not in Incognito mode

### Issue 2: "after-download" status
**Cause**: Model needs to be downloaded
**Solution**: 
- Go to `chrome://components/`
- Download "Optimization Guide On Device Model"
- Wait for completion (can take 10-30 minutes)

### Issue 3: Origin Trials Question
**For localhost**: NO Origin Trial needed ✅
**For production domain**: YES, get token from https://developer.chrome.com/origintrials/

### Issue 4: Incognito Mode
Chrome AI APIs are **disabled in Incognito mode** for privacy.
**Solution**: Use normal browsing mode

### Issue 5: Extensions Interfering
Some extensions may block AI APIs.
**Solution**: Test in Chrome with extensions disabled:
```bash
chrome --disable-extensions
```

## Alternative: Use Chrome Canary

If Chrome Dev still doesn't work after all steps:

1. Download Chrome Canary: https://www.google.com/chrome/canary/
2. Install alongside your existing Chrome
3. Enable all flags in Canary
4. Double restart
5. Test in Canary

Chrome Canary typically has the most up-to-date AI features.

## When AI Works

You'll know it's working when:
1. The status bar shows "AI Tools:" with colored buttons
2. Console shows `[ChromeAI] capabilities` log with available APIs
3. You can click "Expand", "Summarize", or "Improve" buttons

## Production Deployment

For deploying to a real domain (not localhost):

1. **Get Origin Trial Token**:
   - Visit: https://developer.chrome.com/origintrials/
   - Register for "Prompt API" trial
   - Get token for your domain

2. **Add token to index.html**:
   ```html
   <meta http-equiv="origin-trial" content="YOUR_TOKEN_HERE">
   ```

3. **Deploy with HTTPS**:
   - Chrome AI requires secure context (HTTPS)
   - Won't work on http:// in production

## Still Not Working?

If after all these steps AI is still unavailable:

1. Check Chrome release notes for your version
2. Verify your OS is supported (Windows, Mac, Linux, ChromeOS)
3. Ensure you have at least 4GB free disk space for model
4. Try creating a new Chrome user profile (might be profile corruption)

## Contact

If you continue having issues, share:
- `chrome://version/` output
- `chrome://components/` screenshot (Optimization Guide section)
- Console output from verification commands above