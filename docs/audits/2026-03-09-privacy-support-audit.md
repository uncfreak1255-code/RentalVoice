# Privacy & Support Truth Audit — 2026-03-09

## Summary

Multiple user-facing claims in the Privacy & Security screen and Help Center are misleading or false relative to actual code behavior. The most critical issues are: (1) an "End-to-End Encryption" claim that has no E2E implementation, (2) a "data stays on your device" claim that is false in commercial mode and incomplete even in personal mode (data goes to Hostaway APIs), (3) a "Live Chat" support channel that does not exist, and (4) export functionality that omits message content while implying full export. These must be corrected before App Store submission.

## Claim-by-Claim Audit

### PrivacySecurityScreen.tsx

| # | Claim (exact text) | Verdict | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 1 | **"End-to-End Encryption" / "All messages and data are encrypted in transit and at rest"** | **FALSE** | No E2E encryption exists anywhere in the codebase. HTTPS provides transport encryption. `expo-secure-store` uses Keychain/Keystore for credential storage. Zustand data is persisted via `AsyncStorage` which is **not encrypted at rest** (it is a plain JSON file on disk). Messages in the store are not encrypted. | **CRITICAL** — Apple will reject for false security claims. Also potential FTC issue for deceptive trade practice. | Change to "Secure Storage" / "Credentials stored using platform-native encryption. Data transmitted over secure connections." |
| 2 | **"Secure API Connection" / "Hostaway credentials stored with expo-secure-store"** | **PARTIALLY TRUE** | `secure-storage.ts` does use `expo-secure-store` (Keychain/Keystore) for Hostaway account ID and API key. However, it falls back to `AsyncStorage` (unencrypted) when SecureStore is unavailable (Expo Go, web). The claim doesn't mention the fallback. | **MEDIUM** — Technically true on production iOS builds but misleading about fallback. | Change description to "Hostaway credentials stored using platform-native secure storage when available." |
| 3 | **"Privacy-First Design" / "No data sold or shared — your data stays on your device"** | **FALSE** | In personal mode, API credentials are sent to Hostaway servers. Messages, conversations, guest info are fetched from Hostaway. In commercial mode, data is sent to the Rental Voice backend server (`api.rentalvoice.app`), and learning data is sent via `/api/migration/local-learning/import`. Analytics events are sent to the server. The migration module (`commercial-migration.ts`) exports host style profiles, learning entries, draft outcomes, calibration entries, etc. to the server. | **CRITICAL** — "Data stays on your device" is objectively false. Data goes to Hostaway, and in commercial mode to the Rental Voice backend and Supabase. | Change to "Your data is not sold to third parties. In personal mode, data is stored locally and shared only with your connected PMS." |
| 4 | **"Your Data is Protected" / "All security features are active and verified."** | **FALSE** | There is no verification system. The banner always shows this message regardless of actual state. There's no runtime check that security features are "active." | **LOW-MEDIUM** — Misleading but not a showstopper. | Change to "Your privacy settings are shown below." |
| 5 | **"Export My Data" / "Download a copy of your data as JSON"** | **PARTIALLY TRUE** | The export function (`handleExportData`) exports property names/addresses and conversation count, but explicitly excludes message content: `note: 'Full message content is not included for privacy. Contact support for a complete data export.'` The user sees "Export My Data" which implies completeness. | **MEDIUM** — GDPR/CCPA require complete data export on request. The feature exists but is incomplete. Apple may question this. | Change button subtitle to "Export a summary of your data (excludes message content)." |
| 6 | **"Delete All Data" / "Permanently remove all local data"** | **PARTIALLY TRUE** | `resetStore()` resets Zustand state to defaults. However, it does NOT clear `SecureStore` credentials, `AsyncStorage` persistence, or cold storage. It also does not delete any data that was already sent to the Rental Voice server in commercial mode. | **MEDIUM** — User expects "delete everything" but credentials and server-side data persist. | Change to "Reset App Data" / "Clear local app data. Credentials and any server-synced data must be managed separately." |
| 7 | **"Terms of Service" and "Privacy Policy" links** | **FALSE** | These are `<Text>` elements styled as links but have no `onPress` handler. They don't navigate anywhere. No actual Terms of Service or Privacy Policy documents exist. | **CRITICAL** — Apple requires a working Privacy Policy URL. These are non-functional decorative text. | Either implement actual document links or remove until real documents exist. |

### HelpCenterScreen.tsx

| # | Claim (exact text) | Verdict | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 8 | **"Email Support" / "support@rentalreply.ai"** | **UNVERIFIABLE** | The email address `support@rentalreply.ai` opens a `mailto:` link. Whether this mailbox actually exists and is monitored cannot be verified from code. Note the domain is `rentalreply.ai` not `rentalvoice.app`. | **HIGH** — If this mailbox doesn't exist or isn't monitored, Apple will flag unresponsive support. Domain mismatch raises questions. | Verify mailbox exists. Consider using `support@rentalvoice.app` for brand consistency. |
| 9 | **"Live Chat" / "Available 9am - 5pm EST"** | **FALSE** | The Live Chat button has no `onPress` handler. It's a dead UI element that doesn't do anything when pressed. There is no live chat implementation anywhere in the codebase. | **HIGH** — Advertising non-existent support channel. Apple reviewers may test this. | Remove Live Chat row entirely, or replace with "In-App Feedback (Coming Soon)" with a disabled state. |
| 10 | **"Is my data secure?" FAQ answer: "Rental Voice encrypts your data in transit and at rest."** | **FALSE** | Same as claim #1. Data at rest in AsyncStorage is not encrypted. Only SecureStore credentials are encrypted. | **HIGH** — Reinforces the false E2E encryption claim in a different screen. | Change to "Rental Voice uses secure connections (HTTPS) for data transfer. Hostaway credentials are stored using platform-native secure storage." |
| 11 | **"encrypted workspace storage in managed commercial mode"** | **PARTIALLY TRUE** | Commercial mode stores auth tokens via SecureStore (when available) and data in Supabase (which has encryption at rest). But the claim implies the app itself does the encryption, which it doesn't — it relies on infrastructure. | **LOW** | Change to "server-managed storage in commercial mode." |
| 12 | **"What does Privacy Compliance scanning do?" answer re GDPR/CCPA** | **PARTIALLY TRUE** | `privacy-scanner.ts` exists and does scan for PII patterns (credit cards, SSNs, etc.). It's integrated into `MessageComposer.tsx`. However, it is not a compliance tool — it's a regex-based scanner. Claiming it helps "stay compliant with GDPR and CCPA" overstates its capability. | **MEDIUM** — Could be seen as giving legal compliance advice. | Change to "The privacy scanner flags potential sensitive data like card numbers and personal identifiers in AI drafts, helping you catch accidental data exposure before sending." |
| 13 | **"How accurate are AI responses?" answer** | **TRUE** | The answer is hedged appropriately: "based on your property knowledge base, past conversation history, and guest context." It doesn't make specific accuracy claims. | N/A | No change needed. |
| 14 | **"What languages does the AI support?" lists 10+ languages** | **UNVERIFIABLE** | Language support depends on the underlying AI model (OpenAI/Anthropic/etc.), not on Rental Voice code. The app has language detection but actual response quality in all listed languages depends on the provider. | **LOW** | Add qualifier: "Language capabilities depend on the AI model in use." |
| 15 | **AutoPilot FAQ: "automatically sends AI-generated responses that meet your confidence threshold"** | **TRUE** | `SettingsScreen.tsx` implements confidence threshold slider (50-100%). AutoPilot toggle exists with confirmation alert. | N/A | No change needed. |

### OnboardingScreen.tsx

| # | Claim (exact text) | Verdict | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 16 | **"Your credentials are stored securely on your device and never shared with third parties."** | **PARTIALLY TRUE** | In personal mode, credentials go to Hostaway (which is the user's own PMS, not a "third party" in context). In commercial mode, credentials are sent to `connectHostawayServer()` which sends them to the Rental Voice backend — technically a third party from the user's perspective. The "never shared" claim is false in commercial mode. | **MEDIUM** | Change to "Your credentials are stored using platform-native secure storage." Remove "never shared with third parties." |

### SettingsScreen.tsx

| # | Claim (exact text) | Verdict | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 17 | **"AI Accuracy" percentage display** | **TRUE** | Calculated as `aiResponsesApproved / total * 100` where total includes approved + edited + rejected. This is approval rate, not accuracy per se, but it's computed from real data. | **LOW** | Consider labeling "Approval Rate" instead of "AI Accuracy" for precision. |
| 18 | **"The AI analyzes your past messages to match your tone, greetings, and sign-off style."** | **TRUE** | `ai-learning.ts` (`analyzeConversationsForStyle`) and training service do analyze host messages for style patterns. | N/A | No change needed. |

### ApiSettingsScreen.tsx (from grep results)

| # | Claim (exact text) | Verdict | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 19 | **"Your credentials are encrypted and stored securely using platform-native encryption (Keychain on iOS, Keystore on Android)."** | **PARTIALLY TRUE** | True when SecureStore is available. Falls back to unencrypted AsyncStorage otherwise. | **LOW** — On production iOS builds this is accurate. | No change needed for production, but could add "when available" for completeness. |

## Privacy Data Map

### What is stored in SecureStore (on-device, platform-encrypted)
- `hostaway_account_id` — Hostaway Account ID
- `hostaway_api_key` — Hostaway API Secret Key
- `hostaway_access_token` — OAuth access token for Hostaway
- `hostaway_token_expires_at` — Token expiration timestamp
- `hostaway_stable_account_id` — Permanent Hostaway user ID
- `hostaway_stable_account_source_account_id` — Source binding for stable ID
- `hostaway_migration_done` — Migration completion flag
- `hostaway_commercial_learning_import_done` — Learning import flag
- `rv-auth-token` — Commercial mode auth token (api-client.ts)
- `rv-refresh-token` — Commercial mode refresh token (api-client.ts)

**Fallback**: When SecureStore is unavailable (Expo Go, web), ALL of the above fall back to AsyncStorage (unencrypted JSON on disk).

### What is stored in Zustand / AsyncStorage (on-device, NOT encrypted)
- `conversations` — All guest conversations with full message history
- `properties` — All property details (names, addresses, images)
- `propertyKnowledge` — WiFi passwords, check-in codes, emergency contacts, house rules
- `learningEntries` — AI learning training data (in cold storage)
- `draftOutcomes` — Draft approval/edit/reject outcomes (in cold storage)
- `hostStyleProfiles` — Host communication style analysis
- `aiLearningProgress` — Training progress metrics
- `calibrationEntries` — AI calibration data (in cold storage)
- `conversationFlows` — Conversation flow patterns (in cold storage)
- `replyDeltas` — Host edit diff data (in cold storage)
- `settings` — All user preferences including API keys (duplicated from SecureStore)
- `analytics` — Usage statistics
- Guest PII: names, emails, phone numbers, avatars

### What is sent to the Rental Voice server (commercial mode only)
- Auth tokens (login/signup)
- Hostaway credentials (via `connectHostawayServer`)
- AI draft generation requests (conversation context, property knowledge)
- Learning data migration snapshots (host style profiles, learning entries, draft outcomes, reply deltas, calibration entries, conversation flows)
- Analytics events
- Billing/subscription data
- Usage metering data
- History sync data (Hostaway conversations fetched server-side)

### What is sent to Hostaway (personal mode)
- Account ID and API Key (for authentication)
- Message send requests (guest replies)
- Conversation fetch requests

### What third parties receive data
| Third Party | Data Sent | Mode |
|---|---|---|
| Hostaway | Credentials, message content (sends), conversation reads | Personal + Commercial |
| AI Providers (OpenAI/Anthropic/etc.) | Conversation context, property knowledge, guest messages | Personal (direct) or Commercial (via backend proxy) |
| Rental Voice Backend | See "sent to server" above | Commercial only |
| Supabase | User accounts, learning data, migration snapshots | Commercial only (server-side) |
| Expo Push Notifications | Push tokens, notification payloads | Both modes (when enabled) |

## Recommended Copy Changes

### PrivacySecurityScreen.tsx — features array (line 132-136)

**Before:**
```typescript
{ icon: Lock, title: 'End-to-End Encryption', desc: 'All messages and data are encrypted in transit and at rest' },
{ icon: Shield, title: 'Secure API Connection', desc: 'Hostaway credentials stored with expo-secure-store' },
{ icon: Eye, title: 'Privacy-First Design', desc: 'No data sold or shared — your data stays on your device' },
```

**After:**
```typescript
{ icon: Lock, title: 'Secure Connections', desc: 'Data transmitted over encrypted HTTPS connections' },
{ icon: Shield, title: 'Secure Credential Storage', desc: 'PMS credentials stored using platform-native secure storage' },
{ icon: Eye, title: 'Privacy-First Design', desc: 'Your data is not sold to advertisers or data brokers' },
```

### PrivacySecurityScreen.tsx — banner (line 157-158)

**Before:** "Your Data is Protected" / "All security features are active and verified."
**After:** "Privacy Settings" / "Manage your privacy and security preferences below."

### PrivacySecurityScreen.tsx — export subtitle (line 230)

**Before:** "Download a copy of your data as JSON"
**After:** "Export a summary of your properties and usage data"

### PrivacySecurityScreen.tsx — delete subtitle (line 244)

**Before:** "Permanently remove all local data"
**After:** "Reset local app data and preferences"

### HelpCenterScreen.tsx — FAQ answer for "Is my data secure?" (line 50)

**Before:** "Yes. Rental Voice encrypts your data in transit and at rest. Hostaway connection credentials are stored in secure device storage in personal mode and encrypted workspace storage in managed commercial mode."
**After:** "Yes. Rental Voice uses secure connections (HTTPS) for all data transfers. Your PMS credentials are stored using platform-native secure storage. In commercial mode, data is managed through secure server infrastructure."

### HelpCenterScreen.tsx — FAQ answer for Privacy Compliance scanning (line 52)

**Before:** "The privacy scanner checks your AI drafts and conversation history for sensitive data like credit card numbers, SSNs, and personal information -- helping you stay compliant with GDPR and CCPA."
**After:** "The privacy scanner flags potential sensitive data like card numbers and personal identifiers in messages, helping you catch accidental data exposure before sending."

### HelpCenterScreen.tsx — Remove or disable Live Chat (lines 243-250)

Remove the Live Chat row entirely until the feature exists.

### OnboardingScreen.tsx — Security note (line 255)

**Before:** "Your credentials are stored securely on your device and never shared with third parties."
**After:** "Your credentials are stored using platform-native secure storage."

## App Store Risk Assessment

### Blockers (must fix before submission)

1. **False encryption claims** — Apple reviewers and legal teams scrutinize security claims. "End-to-End Encryption" without actual E2E implementation is grounds for rejection and potential legal liability.

2. **Non-functional Terms of Service / Privacy Policy links** — Apple requires a working Privacy Policy URL in the App Store listing and within the app. The current links are dead text.

3. **Non-functional Live Chat** — Advertising support channels that don't work will fail review if tested.

4. **"Data stays on your device" claim** — False in commercial mode and misleading even in personal mode (data goes to Hostaway).

### Warnings (should fix)

5. **Incomplete data export** — GDPR Article 20 requires data portability. The export excludes message content. Should at minimum note the limitation clearly.

6. **Delete function doesn't clear SecureStore** — "Delete All Data" doesn't actually delete all data.

7. **Support email domain mismatch** — `support@rentalreply.ai` vs app domain `rentalvoice.app`.

## Action Items

1. **[P0/CRITICAL]** Fix all encryption/E2E claims in PrivacySecurityScreen.tsx and HelpCenterScreen.tsx
2. **[P0/CRITICAL]** Remove non-functional Live Chat from HelpCenterScreen.tsx
3. **[P0/CRITICAL]** Fix "data stays on device" claim in PrivacySecurityScreen.tsx
4. **[P0/CRITICAL]** Create actual Terms of Service and Privacy Policy documents (or remove links)
5. **[P1/HIGH]** Fix onboarding "never shared with third parties" claim
6. **[P1/HIGH]** Verify support@rentalreply.ai mailbox exists and is monitored
7. **[P1/HIGH]** Fix data export UI to clarify it is a summary, not complete export
8. **[P2/MEDIUM]** Fix delete data description to reflect actual behavior
9. **[P2/MEDIUM]** Fix GDPR/CCPA compliance claim in privacy scanner FAQ
10. **[P2/MEDIUM]** Fix "all security features active and verified" banner
11. **[P3/LOW]** Consider renaming "AI Accuracy" to "Approval Rate" in SettingsScreen
