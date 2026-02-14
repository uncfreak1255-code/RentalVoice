# RentalReply AI

Smart guest communication app for vacation rental property managers. AI-powered messaging, automation, and analytics - similar to HostBuddy and Enso Connect.

## Features

### Phase 1: Core AI Functionality

#### Hostaway Integration
- Connect your Hostaway account with Account ID and API Key
- Automatically syncs all your properties/listings
- Fetches guest conversations and messages in real-time
- Send messages directly through Hostaway API
- Pull-to-refresh to get the latest data
- **Auto-refresh every 30 seconds** while inbox is open
- Silent background polling with sync indicator
- Tap sync icon to manually trigger refresh
- Shows "last synced" time (e.g., "30s ago")

#### AI-Powered Messaging (Multi-Provider with Automatic Fallback)
- **Multiple AI Providers**: Google Gemini (primary), Claude Haiku (fallback), and local smart responses
- **Automatic Fallback System**:
  - Tries Google Gemini first for fast, cost-effective responses
  - Falls back to Claude if Gemini is unavailable
  - Uses intelligent local responses if both APIs fail
- AI automatically drafts personalized responses based on conversation context
- Property-specific knowledge base integration (WiFi, check-in instructions, etc.)
- Confidence score shows how reliable the AI draft is
- Actions: Approve & Send, Edit, Regenerate, Dismiss
- Sentiment analysis (positive, neutral, negative, urgent)
- Intent detection (WiFi inquiry, check-in, maintenance, etc.)

#### CoPilot & AutoPilot Dual Mode System (ENHANCED)
- **CoPilot Mode (Default)**: AI suggests drafts, you manually review and approve every message
  - Full control over all guest communications
  - Confidence scores shown for each suggestion
  - Recommended for accuracy and quality assurance
- **AutoPilot Mode**: Auto-sends high-confidence responses automatically
  - Configurable threshold (70-99%)
  - Below-threshold messages route to CoPilot for manual review
  - Optional schedule controls (specific days and hours)
  - Escalation rules for sensitive topics (money, complaints, refunds)
- **Confidence Meter**: Visual 0-100% score for every AI suggestion
  - Color-coded: Green (90%+), Amber (70-89%), Red (<70%)
  - Animated progress bar with pulse effect for high confidence
  - Breakdown of confidence factors (sentiment, knowledge, style, safety)
  - Auto-send blocking for urgent/angry messages regardless of confidence
- **Action Logging**: Complete audit trail of AutoPilot decisions
  - Tracks auto-sent, escalated, and reviewed messages
  - Guest name, confidence score, and reason for each action
  - Accuracy statistics with percentage tracking
  - Clearable logs with confirmation
- **Per-Property Scheduling**: Control when AutoPilot is active
  - Select specific days of the week
  - Set active hours (e.g., Mon-Fri 9am-5pm)
  - Outside schedule hours, messages route to CoPilot
- **Escalation Rules**: Force manual review for sensitive topics
  - Default topics: refund, money, price, damage, complaint, legal, lawsuit, compensation
  - Regardless of confidence score, these topics always require human approval

#### Property Knowledge Base
- Configure per-property information:
  - WiFi credentials
  - Check-in/check-out instructions
  - Parking information
  - House rules
  - Appliance guides
  - Local recommendations
  - Emergency contacts
  - Communication tone preference (friendly/professional/casual)
  - Upsell options (early check-in, late checkout)

### Phase 2: Workflow & Automation

#### Conversation Workflow States
- Inbox view with filter tabs: All, To-Do, Follow-Up, Urgent, Resolved, Archived
- Easily manage conversation status and priority

#### Issue Tracking System
- Create and manage guest issues
- Categories: Maintenance, Cleanliness, Amenity, Noise, Access, Other
- Priority levels: Low, Medium, High, Urgent
- Track status: Open, In Progress, Resolved

#### Smart Automations with AI Personalization (NEW)
- **AI-Powered Templates**: Templates that auto-personalize based on guest details
- **Smart Categories**: Check-in, Check-out, Welcome, Review Request, Issue Response, Upsell
- **Personalization Instructions**: Tell the AI how to customize each template
- **Pre-built Smart Templates**:
  - Pre-Arrival Welcome (24h before check-in)
  - Welcome Message (2h after check-in)
  - Mid-Stay Check-in (48h after check-in)
  - Check-out Reminder (14h before checkout)
  - Review Request (24h after checkout)
- Variable substitution: guest name, property name, WiFi, dates, etc.
- AI learns your style and applies it to templated messages

### Phase 3: Analytics & Learning

#### Analytics Dashboard
- Total messages handled
- AI response quality metrics (approval rate, edit rate, rejection rate)
- Autonomy rate (% of messages handled without human intervention)
- Time saved calculations
- Upsell revenue tracking
- Open issues count

#### AI Learning System
- **Style Learning**: Analyzes your past messages to learn your communication style
- **Per-Property Profiles**: Different style profiles for each property
- **Continuous Improvement**: Learns from every approval, edit, and rejection
- **Pattern Recognition**: Detects greetings, sign-offs, emoji usage, formality level, warmth
- **Common Phrases**: Identifies and reuses your frequent phrases
- **Training Progress**: View learning statistics and accuracy scores
- **Reset Option**: Clear all learned data and start fresh

#### Edit Diff Analysis (NEW)
- **Learn from Every Edit**: When you modify an AI draft before sending, the system analyzes exactly what you changed
- **Change Detection**: Automatically detects:
  - Length changes (shortened/lengthened)
  - Tone shifts (more formal/casual)
  - Emoji additions/removals
  - Greeting and sign-off preferences
  - Added or removed information
  - Empathy and warmth adjustments
- **Preference Learning**: Builds a profile of your editing patterns:
  - Preferred greetings (e.g., "Hi there!", "Hello")
  - Preferred sign-offs (e.g., "Thanks!", "Best regards")
  - Length preference (shorter vs longer responses)
  - Tone preference (warmer vs cooler)
  - Common phrases you add
  - Phrases you typically remove
- **Real-Time Feedback**: Shows a toast notification after each edit explaining what the AI learned
- **Automatic Prompt Adjustment**: Future AI drafts incorporate your learned preferences
- **Property-Specific**: Can learn different preferences for different properties

#### Rejection Learning (NEW)
- **Learn from Dismissed Drafts**: When you dismiss an AI draft, the system analyzes why
- **Issue Detection**: Automatically identifies potential problems:
  - Response too long or too short
  - Too generic/templated
  - Missing personalization
  - Inappropriate emoji usage
  - Didn't address the guest's question
- **Pattern Recognition**: Builds understanding of what NOT to do
- **Prompt Adjustments**: Future drafts avoid detected issues
- **Feedback Toast**: Shows what was learned when you dismiss a draft

#### Guest Type Detection (NEW)
- **Automatic Detection**: Identifies guest type from conversation signals:
  - **Family**: Kids, cribs, highchairs, playgrounds mentioned
  - **Couple**: Anniversary, honeymoon, romantic getaway signals
  - **Business**: Work, conference, WiFi, quiet workspace needs
  - **Group**: Friends, party, bachelor/bachelorette, reunions
  - **Solo**: Traveling alone, single guest
- **Purpose Detection**: Vacation, business, wedding, anniversary, birthday, etc.
- **Tone Adaptation**: AI automatically adjusts tone based on guest type:
  - Professional for business travelers
  - Warm and detailed for families
  - Casual for groups of friends
- **Special Consideration**: Detects first-time guests, returning guests, pets

#### Proactive Messaging Alerts (NEW)
- **Smart Notifications**: Proactively alerts you when action is needed:
  - **No Response**: Guest waiting >2 hours for a reply
  - **Missing Check-in Instructions**: Check-in approaching but no instructions sent
  - **Check-in/Checkout Day**: Reminders on arrival and departure days
  - **Review Request Timing**: Optimal time to request a review (1-2 days post-checkout)
  - **Unanswered Question**: Guest asked a question that wasn't answered
  - **Guest Issue**: Problem reported that needs immediate attention
- **Priority Levels**: Urgent, High, Medium, Low
- **Actionable Suggestions**: Each alert includes recommended action

#### Booking Probability Scoring (NEW)
- **Conversion Prediction**: Estimates likelihood of inquiry converting to booking
- **Scoring Factors**:
  - Response time (faster = higher probability)
  - Message volume and engagement
  - Question specificity (detailed questions = more serious)
  - Dates mentioned (specific dates = higher intent)
  - Price discussion signals
  - Urgency signals (ASAP, soon, this week)
  - Negative signals (price concerns, comparison shopping)
- **Category Ratings**: Very Likely, Likely, Moderate, Unlikely, Very Unlikely
- **Actionable Recommendations**: Specific tips to improve conversion chances
- **Signal Breakdown**: See exactly what's helping or hurting booking probability

#### Historical Data Import (Enhanced)
- **Comprehensive History Fetch**: Import all past Hostaway conversations with pagination
- **Resumable Background Jobs**: Sync saves progress and can resume after interruption
- **Exponential Backoff**: Handles rate limits with progressive retry delays (5s, 10s, 20s, etc.)
- **Batch Processing**: Processes 50-100 conversations at a time with 2-5 second pauses
- **Date Range Filtering**: Choose custom time periods (3, 6, 12, 24 months, or all time)
- **Real-time Progress Tracking**:
  - Accurate percentage with phase indicators
  - Estimated time remaining
  - Current batch / total batches display
  - Messages and conversations processed count
- **User Controls**:
  - Pause button to temporarily stop sync
  - Resume button to continue from pause
  - Cancel button with progress saved for later
  - "Start Fresh" option to restart from beginning
- **Error Handling**:
  - Error count display with expandable log
  - Automatic retry for transient failures
  - Graceful skipping of problematic conversations
- **Pattern Extraction**: Analyzes host responses to detect:
  - Response patterns by guest intent (check-in, WiFi, issues, etc.)
  - Communication style metrics (formality, warmth, length)
  - Common greetings and sign-offs
  - Phrase frequency analysis
- **Privacy Compliant**: Only anonymized patterns are stored (emails, phones, addresses removed)
- **Incremental Learning**: Merges new data with existing style profiles
- **Intent Detection**: Categorizes responses by guest question type

#### Background Sync (NEW)
- **Continue in Background**: Sync history even when the app is closed
- **expo-task-manager & expo-background-fetch**: Uses native iOS/Android background execution APIs
- **Automatic Periodic Runs**: System wakes the app every 15-30 minutes (iOS) to continue syncing
- **Progress Persistence**: All sync progress is saved to AsyncStorage for reliable resumability
- **Progress Notifications**: Shows ongoing notification with sync status
- **System Status Detection**:
  - Checks Background App Refresh availability
  - Handles Restricted (Low Power Mode) and Denied states
  - Falls back to foreground-only mode when unavailable
- **User Controls**:
  - "Enable Background Sync" to start syncing in background
  - "Speed Up" to process faster while app is open (foreground mode)
  - "Stop" to disable background sync
  - Clear background sync state to start fresh
- **Smart Chunk Processing**: Processes data in small chunks (25 seconds max) per background wake
- **WorkManager-style Behavior** (Android): Survives app termination and device reboots

#### Quick Reply Templates (NEW)
- **Template Management**: Create, edit, and organize quick reply templates
- **Import Options**:
  - Manual text entry
  - CSV import (name, content, category columns)
  - Paste multiple templates at once
- **Smart Categories**: WiFi, Check-in, Check-out, Parking, Amenities, Issue, Thanks, Booking, General
- **Property-Specific or Global**: Templates can apply to specific properties or all properties
- **AI-Powered Template Matching**:
  - Automatic keyword extraction from template content
  - Smart matching against guest messages
  - Priority scoring for best template selection
  - Templates boost AI confidence when matched
- **Favorite Messages**:
  - Mark any sent message as a favorite directly in chat (star icon)
  - Favorites are automatically included in AI learning
  - Convert favorites to reusable templates
- **Template Analysis**:
  - Automatic tone detection (formal, casual, friendly, professional)
  - Length classification (short, medium, long)
  - Greeting and sign-off detection
- **High-Priority Training**: Templates treated as premium training data for AI response generation
- **Usage Tracking**: See how often each template is used

#### AI Suggestion Mode (When Auto-Pilot is OFF)
- Suggestions appear directly in the text box with `[AI Suggestion]: ` prefix
- Edit directly in the text box before sending
- Regenerate button for new suggestions
- Info tooltip explains how it works
- Purple accent color distinguishes from manual typing
- Clear button to dismiss and write your own message

#### Enhanced AI Draft Editing Experience (NEW)
- **Natural Editing**: AI drafts render inside a fully editable multiline TextInput
- **Smooth Cursor Placement**: Tap anywhere to place cursor, double-tap to select word, triple-tap to select all
- **Auto-Focus**: When AI suggestion loads, TextInput auto-focuses with cursor at the end for immediate editing
- **Scrollable Drafts**: Long drafts auto-expand up to 200px, then scroll - no more manual backspacing
- **Keyboard Persistence**: Uses `keyboardShouldPersistTaps='always'` to prevent double-tap keyboard dismiss issues
- **Clear Draft Button**: Dedicated trash icon button next to Send and Regenerate to quickly wipe AI text
- **Responsive Layout**: Buttons wrap naturally on smaller screens

### Phase 4: Advanced AI Features (NEW)

#### Sentiment Analysis & Adaptive Tone
- **Emotion Detection**: Detects guest emotions (frustrated, excited, confused, grateful, anxious, angry, happy)
- **Adaptive Responses**: AI adjusts tone based on detected sentiment
- **Escalation Alerts**: Automatic notifications for urgent/angry messages
- **Intensity Scoring**: 0-100 scale for sentiment intensity

#### Multi-Topic Handling
- **Smart Parsing**: Detects multiple questions in one message (e.g., "What's the WiFi and can I check in early?")
- **Comprehensive Replies**: Generates single responses covering all topics
- **Priority Ordering**: Topics sorted by importance/urgency
- **Knowledge Matching**: Links each topic to available property knowledge

#### Regeneration Options
- **More Empathy**: Add understanding and care to the response
- **Shorter**: Make it more concise
- **More Details**: Add additional helpful information
- **More Formal**: Professional tone
- **More Casual**: Friendly and relaxed tone

#### Confidence Scoring & Guardrails
- **Visible Confidence Meter**: Shows 0-100% score for each suggestion
- **Confidence Breakdown**: View factors affecting confidence
  - Sentiment Match
  - Knowledge Available
  - Topic Coverage
  - Style Match
  - Safety Check
- **Auto-Send Blocking**: Blocks auto-send for:
  - Urgent messages
  - Angry guests
  - Refund requests
  - Financial topics without verified info
- **Hallucination Prevention**: Checks responses against property knowledge

#### Knowledge Base Conflict Detection
- Detects inconsistencies in property data
- Alerts for outdated information
- Flags missing required info (e.g., WiFi name without password)
- Suggests fixes for detected conflicts

#### AI Transparency & Reasoning (NEW)
- **"How I Arrived at This" Section**: Expandable reasoning panel for every AI draft
  - Step-by-step breakdown of AI decision process
  - Sources used (historical replies, knowledge base)
  - Confidence factors with percentages
  - Warnings and escalation flags
- **Reasoning Steps Shown**:
  - Sentiment Detection: How guest emotion was identified
  - Topics Identified: What questions/topics were found
  - Historical Matches: Similar past replies used as basis
  - Knowledge Base: Property info used in response
  - Confidence Score: Overall and per-factor breakdown
  - Warnings: Any flags or concerns detected
  - Conflicts: Data inconsistencies found
- **Historical Reply Matching**:
  - Shows when response is based on similar past replies
  - Displays match count and similarity percentage
  - Preview of matched patterns used
- **Conflict Auto-Detection**:
  - Scans messages for info that conflicts with knowledge base
  - Detects WiFi password/name mismatches
  - Finds check-in/check-out time inconsistencies
  - Identifies door code discrepancies
  - Flags outdated year references
- **One-Click Fixes**:
  - Quick fix buttons for detected conflicts
  - Updates knowledge base directly from chat
  - Removes conflict after fix applied
  - Haptic feedback on successful update

#### Action Item Detection
- **Automatic Detection**: Scans messages for issues needing follow-up
- **Issue Types**: Maintenance, Follow-up, Escalation, Refund, Upsell, Emergency
- **Priority Assignment**: Auto-assigns priority based on urgency
- **Task Creation**: Creates internal tasks for detected issues
- **Integration**: Links to Issue Tracker system

### Phase 5: Multi-Channel & Integration (NEW)

#### Multi-Channel Support
- **Unified Inbox**: View messages from all channels in one place
- **Supported Channels**:
  - Hostaway
  - WhatsApp (rich text, media)
  - SMS (160 char limit)
  - Email (HTML/rich text)
  - Airbnb
  - Vrbo
  - Booking.com
- **Channel-Specific Formatting**: Auto-formats messages for each platform
- **Media Validation**: Checks attachment size/type per channel

#### OTA Channel Detection (ENHANCED)
- **Multi-Source Detection**: Identifies channel from `channelName`, `channelId`, and `source` fields
- **Hostaway Channel IDs**:
  - Airbnb: 2000
  - Vrbo/HomeAway: 2016
  - Booking.com: 2002
- **OTA Logo Badges**: Each conversation shows the booking channel logo:
  - Airbnb: Red "A" logo (#FF5A5F)
  - Booking.com: Blue "B" logo (#003580)
  - Vrbo: Blue "V" logo (#0050F0)
  - Direct: Teal "D" logo (#14B8A6)
- **Debug Logging**: Logs "Vrbo message fetched: [id]" for verification
- **Channel Distribution**: Logs count of conversations per channel on refresh

#### Language Detection & Translation
- Auto-detect guest language from messages
- AI responds in the guest's language
- Supports: English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Russian, Dutch

#### Cultural Tone Adaptation (NEW)
- **Auto-Detection**: Automatically detects guest language from message content or reservation data
- **Culturally-Adjusted Responses**: AI generates replies that are not just translated, but culturally appropriate:
  - **German/Japanese**: More formal, precise, thorough responses with honorific language
  - **Spanish/Italian**: Warmer, more expressive, personal communication style
  - **French**: Formal elegance with proper vous/tu distinction
  - **English**: Direct and friendly, balanced tone
  - **Chinese/Korean**: Respectful, courteous, indirect when appropriate
  - **Arabic**: Warm hospitality focus
  - **Portuguese**: Warm and personal style
  - **Russian**: Direct and sincere
- **Cultural Tone Profiles**: Each language has specific settings:
  - Formality level (0-100 scale)
  - Warmth level (0-100 scale)
  - Directness level (0-100 scale)
  - Appropriate greetings and sign-offs
  - Cultural notes and considerations
  - Emoji usage preferences
  - Response length preferences
- **Learned Language Styles**: AI learns from historical examples in each language to better match your communication style per language
- **AI Reasoning Display**: Shows cultural adaptations applied in the "How I Arrived at This" section
- **Settings Controls**:
  - Toggle Cultural Tone Adaptation on/off
  - Toggle Auto-Detect Guest Language
  - Preview cultural profile for each language
  - See example responses adapted for different cultures

#### Attachment & Media Handling
- Support for sending/receiving:
  - Photos
  - PDFs (guidebooks, house rules)
  - Documents
- Channel-aware size limits
- Thumbnail previews

### Phase 6: Guest Experience

#### Guest Portal / Digital Guidebook
- Beautiful mobile-friendly property guide
- Quick access to WiFi, check-in instructions, parking
- Stay details with check-in/check-out times
- Collapsible sections for all property information
- Shareable with guests

#### Upsells System
- Early check-in offers
- Late checkout offers
- Revenue tracking
- One-tap offer sending to guests
- Customizable offer messages

#### Post-Stay Automation
- AI-generated thank-you notes based on stay details
- References positive moments from conversation
- Gentle review request
- Personalized to each guest

### Phase 7: Push Notifications (NEW)

#### Real-Time Push Notifications
- **Expo Notifications**: Native push notifications for iOS and Android
- **New Message Alerts**: Instant notifications when guests send messages
- **Notification Content**:
  - Title: "New Message from [Guest Name]"
  - Body: Preview of the message content
  - Data payload with conversation and property IDs
- **Badge Count**: App icon badge updates with unread message count

#### Deep Linking
- **Tap to Open**: Tapping a notification opens the specific conversation
- **Background Updates**: Inbox silently refreshes when notifications arrive

#### Notification Settings
- **Push Notifications Toggle**: Enable/disable in Settings > Notifications
- **Permission Handling**: Graceful handling of denied permissions with prompts

#### Webhook Setup Guide
- **Step-by-step Instructions**: Configure Hostaway webhooks for real-time alerts
- **Push Token Display**: View and copy your device's Expo push token
- **Hostaway Integration**: Set up `message.created` webhook events
- **Copy-to-Clipboard**: Easy copying of webhook URLs and tokens

#### Push Token Management in Settings (ENHANCED)
- **Permission Status Check**: Automatically checks notification permission on screen load
- **Enable Notifications Button**: One-tap button to request push notification permissions
- **Token Display**: Shows Expo Push Token when notifications are enabled
- **Copy Token Button**: Easy one-tap copy to clipboard for Pipedream integration
- **Refresh Token Button**: Re-fetch token with one tap if needed
- **Loading State**: Shows "Loading Token..." spinner while fetching
- **Error Handling**: Displays specific error messages with retry button
- **Device Detection**: Graceful handling for simulators/emulators (push not available)
- **Visual Feedback**: Success animations, haptics, and copied confirmation
- **Persistent Token**: Token stored in AsyncStorage for quick loading on app restart

## Navigation

### Inbox Dashboard (Redesigned - Hostaway-Style Modern Cards)
- **Hostaway-Inspired Design**: Clean, modern card-based layout matching Hostaway's inbox style
- **Header**:
  - Title "Inbox" in 28pt bold with -0.5 letter spacing
  - Connection status (green "Live" or teal "Demo" dot) with 8px indicator
  - AutoPilot badge when enabled with rounded pill style
  - 40px settings button with rounded corners
- **Property Selector** (Prominent):
  - Large trigger button with 40px property thumbnail
  - Property name in 16pt bold with address subtitle
  - Dropdown indicator in rounded gray container
  - Subtle shadow and 1.5px border
  - Shows property count when "All Properties" selected
- **Tab Bar**:
  - Simple underline-style tabs: "All threads", "Archived", "AI Drafts"
  - Active tab with 3px teal underline indicator
  - 15pt font with 600 weight for active state
- **Filter Chips Row**:
  - Horizontal scrollable chips, 36px height with 18px border radius
  - Teal active state with white text
  - White inactive with subtle shadow and gray border
  - Chip style: 14px icon + 13pt bold label + count badge
  - Improved touch targets for better mobile UX
- **Conversation Cards** (Modern Card Design):
  - Rounded 16px corners with 16px padding
  - 12px horizontal margin for card separation
  - Subtle shadow (2px blur, 6% opacity) for depth
  - Teal border highlight for unread conversations
  - Light gray (#F3F4F6) background behind cards
  - Guest photo: 64px circular with 20-26px OTA logo overlay
  - Guest name: 17pt bold when unread, 16pt normal when read (Hostaway-style glanceable unread/read distinction)
  - Property name: 14pt medium weight gray
  - Message preview: 14pt regular, 2-line limit
  - Bottom row: Guest count + dates with icons, status tags on right
  - Status tags: Urgent (red), Inquiry (blue), Excited (green), AI Draft (teal)
  - Unread indicator: 10px red dot next to timestamp
- **Empty State**:
  - 80px rounded icon container with subtle shadow
  - 20pt bold title, 15pt description text
  - Teal call-to-action button with shadow
- **Performance**:
  - FlashList with estimatedItemSize={140}
  - Memoized ConversationItem component
  - expo-image with memory-disk caching and error logging
- Filter tabs: All, Unread, Attention, Urgent, AI Drafts, Follow-Up, Done, Archived
- Sort dropdown: Recent, Unread First, Urgent First

### Chat Interface
- Clean, Airbnb-style message bubbles
- Guest info panel (email, phone, property, dates)
- Real-time message composer with attachment support
- AI draft preview with confidence score and sentiment badge
- Regeneration options (empathy, shorter, longer, formal, casual)
- Auto-pilot toggle per conversation
- Escalation alerts for urgent issues
- Action item detection indicators

### Settings
- Notifications: Push Notifications toggle, Webhook Setup
- AI Settings: AI Automation (CoPilot/AutoPilot modes, threshold, schedule, escalation), AI Learning
- Features: Property Knowledge, Automations, Issue Tracker, Analytics, Upsells
- Connection: Hostaway API status, Sync, Language settings
- Support: Help Center, Privacy & Security, Privacy Compliance

## Demo Mode
- Try the app with realistic sample data
- 5 demo conversations across 3 properties
- Experience all features without connecting Hostaway

## Getting Started

### Connecting Hostaway
1. Open your Hostaway Dashboard
2. Go to Settings > Hostaway API
3. Copy your Account ID and API Key
4. Enter both in the app during onboarding

### Setting Up AI (Required for AI Features)
1. Go to the ENV tab in Vibecode
2. Your Anthropic API key should already be set as `EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY`
3. Uses Claude Haiku for cost-effective AI responses (~$0.25/1M input, ~$1.25/1M output)

### Configuring Property Knowledge
1. Go to Settings > Property Knowledge
2. Select a property
3. Fill in WiFi, check-in instructions, house rules, etc.
4. Choose communication tone preference
5. Enable upsell options with pricing

### Setting Up Smart Automations
1. Go to Settings > Automations
2. Tap "Use Smart Template" or create custom
3. Select a property and trigger timing
4. Enable AI Personalization for automatic customization
5. Add personalization instructions (optional)

## Tech Stack
- Expo SDK 53 / React Native
- NativeWind (TailwindCSS)
- Zustand for state management with AsyncStorage persistence
- Expo Secure Store for encrypted credential storage
- React Query for server state
- React Native Reanimated for animations
- FlashList for performant lists
- Hostaway API (OAuth 2.0)
- **Claude Haiku (Anthropic)** for AI responses - ~10x cheaper than GPT-4o

### Security Features
- **Encrypted Credential Storage**: Hostaway API credentials are stored using Expo SecureStore, which uses Keychain on iOS and Keystore on Android
- **Automatic Token Refresh**: Access tokens are automatically refreshed when expired using stored credentials
- **Session Persistence**: Users don't need to re-enter credentials after closing the app
- **Secure Disconnect**: One-tap disconnect option that clears all stored credentials securely
- **Error Recovery**: Graceful handling of invalid credentials with re-authentication prompts

### Privacy Compliance Features (NEW)

#### AI-Powered Sensitive Data Scanner
- **Real-Time Draft Scanning**: Automatically scans message drafts for sensitive data before sending
- **Detected Data Types**:
  - Credit card numbers (Visa, Mastercard, Amex, Discover)
  - Social Security Numbers (SSN)
  - Phone numbers
  - Email addresses
  - Physical addresses
  - Passport numbers
  - Driver's license numbers
  - Bank account numbers
  - Dates of birth
  - IP addresses
  - Passwords and API keys
  - WiFi passwords
  - Door/access codes
- **Severity Classification**: Critical, High, Medium, Low risk levels
- **Risk Score**: 0-100 aggregate score based on detected issues

#### Auto-Anonymization
- **One-Tap Redaction**: Automatically replaces sensitive data with safe placeholders
- **Smart Masking**: Preserves partial info for context (e.g., `****-****-****-1234` for cards)
- **Reversible**: Original text preserved until you confirm changes
- **Type-Specific Formatting**: Each data type has appropriate masking format

#### Privacy Alert Banner
- **Visual Warnings**: Prominent banner when sensitive data is detected
- **Expandable Details**: See exactly what was found and where
- **Severity Indicators**: Color-coded badges for risk levels
- **Recommendations**: Actionable suggestions for each issue type

#### Compliance Reports
- **Full Conversation Scan**: Analyze all stored messages for sensitive data
- **Report Generation**: Exportable compliance reports in JSON format
- **Statistics Dashboard**:
  - Total messages scanned
  - Issues found by severity
  - Data type breakdown
  - Risk score trending
- **Recommendations**: Personalized privacy improvement suggestions

#### Data Export Options
- **GDPR/CCPA Compliant**: Export all your data on demand
- **Export Conversations**: Download all messages with metadata
- **Export Compliance Reports**: Share audit reports
- **Full Data Backup**: Complete app data export
- **Data Rights Info**: Clear explanation of your privacy rights

#### Privacy Settings
- **Auto-Scan Toggle**: Enable/disable automatic draft scanning
- **Auto-Anonymize Toggle**: Automatically redact detected data
- **Sensitivity Level**: Low/Medium/High detection threshold
- **Delete All Data**: Permanent data removal option

## API Endpoints Used

### Hostaway
- `POST /v1/accessTokens` - Authentication
- `GET /v1/listings` - Fetch properties
- `GET /v1/conversations` - Fetch guest conversations
- `GET /v1/conversations/{id}/messages` - Fetch conversation messages
- `POST /v1/conversations/{id}/messages` - Send messages

### Anthropic (Claude)
- `POST /v1/messages` - Generate AI responses using Claude Haiku

## New Components Added
- `PropertyKnowledgeScreen` - Configure per-property AI knowledge
- `IssueTrackerScreen` - Track and manage guest issues
- `AutomationsScreen` - Set up smart scheduled messages with AI personalization
- `AnalyticsDashboard` - View performance metrics
- `UpsellsScreen` - Create and send upsell offers
- `GuestPortal` - Digital guidebook for guests
- `AILearningScreen` - View and manage AI learning progress
- `ApiSettingsScreen` - Manage Hostaway API connection
- `SyncDataScreen` - View and trigger data syncs
- `LanguageSettingsScreen` - Configure language and translation
- `HelpCenterScreen` - FAQs and support
- `PrivacySecurityScreen` - Privacy controls and data management
- `PrivacyComplianceScreen` - Sensitive data scanning, compliance reports, data export
- `PrivacyAlertBanner` - Real-time privacy warnings in message composer
- `QuickReplyTemplatesScreen` - Manage quick reply templates and favorites
- `WebhookSetupScreen` - Configure push notification webhooks
- `AutoPilotSettingsScreen` - CoPilot/AutoPilot mode configuration with scheduling
- `ConfidenceMeter` - Animated confidence score display with breakdown
- `AIReasoningSection` - Expandable "How I Arrived at This" reasoning panel
- `KnowledgeCoverageDashboard` - Coverage analysis with gap detection, alerts, and one-tap template creation
- `ConversationSummaryDisplay` - Auto-generated conversation summaries with status tracking
- `ReservationSummaryBar` - Hostaway-style fixed reservation bar with guest count, dates, and "See details" button
- `SentimentTrendsDashboard` - Guest sentiment trends and property breakdown

## New Services Added
- `ai-enhanced.ts` - Advanced AI with sentiment analysis, multi-topic handling, confidence scoring, historical response matching
- `ai-training-service.ts` - Comprehensive AI training with ultra-safe batch processing, smart sampling, and historical indexing
- `multi-channel.ts` - Multi-channel messaging support
- `smart-templates.ts` - AI-powered template personalization
- `ai-learning.ts` - Host style analysis and learning
- `secure-storage.ts` - Encrypted credential storage using Expo SecureStore
- `history-sync.ts` - Resumable background history sync with rate limiting and progress tracking
- `background-fetch-service.ts` - Background fetch service for reliable history sync when app is closed
- `notifications.ts` - Push notification service with Expo Notifications
- `NotificationProvider.tsx` - React context for notification handling and deep linking
- `privacy-scanner.ts` - AI-powered sensitive data detection and auto-anonymization
- `autopilot-service.ts` - CoPilot/AutoPilot decision logic, confidence evaluation, scheduling
- `conflict-detection.ts` - Knowledge base conflict detection, message scanning, one-click fixes
- `cultural-tone.ts` - Cultural tone profiles, language-specific communication norms, adaptation instructions
- `knowledge-coverage.ts` - Coverage analysis, question categorization, gap detection, alert generation
- `conversation-summary.ts` - AI-powered conversation summarization with event extraction and status tracking
- `sentiment-analysis.ts` - Real-time guest sentiment classification, trend analysis, and auto-prioritization

### AI Training System (NEW)

#### Ultra-Safe Batch Processing
- **Optimized for Large Histories**: Handles 25,000+ messages without lag or crashes
- **Batch Size**: 250 host-sent messages per batch with 2-3 second pauses
- **Async/Off-Main-Thread**: All processing happens asynchronously to keep the app responsive
- **Progress Tracking**: Real-time progress updates with percentage and time estimates

#### Smart Sampling for Large Datasets
- **10,000+ Message Handling**: For datasets exceeding 10,000 messages, uses intelligent sampling
- **Training Sample Size**: Up to 5,000 varied host replies for deep style training
- **Diversity Criteria**:
  - Property distribution (samples across all properties)
  - Time distribution (samples across time periods)
  - Intent distribution (samples different question types)
  - Length variation (includes short, medium, and long responses)
- **Full History Indexing**: While style training uses a sample, the complete history is indexed for factual recall

#### Historical Response Matching
- **Pattern Indexing**: Creates searchable index of all host response patterns
- **Intent-Based Matching**: Groups responses by detected guest intent (check-in, WiFi, maintenance, etc.)
- **Keyword Indexing**: Fast lookup by keywords for similar past questions
- **Similarity Scoring**: Multi-factor scoring for best match selection:
  - Intent match (40 points)
  - Keyword overlap (10 points per keyword)
  - Sentiment match (15 points)
  - Property match bonus (20 points)
  - Recency bonus (up to 10 points)

#### AI Response Generation with Historical Context
- **History-Based Replies**: When generating responses, searches historical data for similar guest questions
- **Primary Response Basis**: Uses actual past host replies as the primary source for response content
- **Style Wrapping**: Wraps factual content in learned personal style (tone, warmth, emojis, greetings/sign-offs)
- **Confidence Boost**: Historical matches increase AI confidence scores
- **Lower Temperature**: Uses more deterministic generation (0.5 vs 0.7) when strong matches exist
- **Safe Fallback**: If no strong match, generates conservatively with lower confidence flag

#### Auto-Training After History Fetch
- **Automatic Trigger**: Training starts automatically 3 seconds after successful message history fetch
- **One-Time Background Job**: Runs once per fetch, fully async
- **Completion Notification**: "AI fully trained on your history — now answers accurately in your voice!"
- **Progress Display**: Shows training progress banner with phase and percentage

#### Incremental Real-Time Learning
- **Learns from Approvals**: When you approve an AI draft, the pattern is added to the response index
- **Learns from Edits**: Edited responses are more valuable (explicitly corrected by host)
- **No Continuous Re-Training**: Does NOT automatically re-train on old data
- **Efficient Updates**: Index updated incrementally without full reprocessing

#### Manual Training Option
- **"Train on Messages" Button**: Available for optional manual full re-analysis
- **Recommended Frequency**: Every few weeks or when communication style changes
- **Training Status Display**: Shows summary of training state and indexed patterns

### Knowledge Coverage Dashboard (NEW)

#### Coverage Analysis
- **Question Pattern Analysis**: Analyzes all historical guest questions across conversations
- **Coverage Percentage**: Shows overall % of questions with strong historical answers (e.g., "92% coverage")
- **Dual Coverage Metrics**:
  - Knowledge Base Coverage: Questions answered by property knowledge
  - Template Coverage: Questions matched by quick reply templates
- **Category Breakdown**: Coverage stats by question type (WiFi, Check-in, Parking, etc.)

#### Question Categories Tracked
- WiFi & Internet
- Check-in / Check-out
- Parking
- Amenities & Appliances
- House Rules
- Local Recommendations
- Emergency & Safety
- Maintenance Issues
- Booking & Reservation
- Thank You & Feedback

#### Gap Detection
- **Automatic Gap Identification**: Finds questions asked repeatedly without good templates
- **Impact Classification**: High, Medium, Low priority based on frequency
- **Gap Descriptions**: Shows sample questions and occurrence counts (e.g., "10 guests asked about beach parking")
- **Suggested Fixes**: Actionable recommendations for each gap

#### One-Tap Template Creation
- **Create from Gap**: Tap any gap to instantly start creating a new template
- **Pre-filled Suggestions**: Template name, category, and keywords auto-suggested
- **Example Questions**: Shows the actual guest questions to help write better responses
- **Smart Category Mapping**: Automatically assigns appropriate template category

#### Coverage Alerts
- **Alert Types**:
  - New Question Pattern: Detects emerging question types
  - Coverage Drop: Warns when coverage percentage decreases
  - Repeated Gap: High-frequency questions without answers
  - Slow Response: Questions with delayed reply times
- **Severity Levels**: High, Medium, Low with color-coded badges
- **Dismissible**: Clear alerts after taking action
- **Alert Descriptions**: Explains the issue and suggested resolution

#### Dashboard UI
- **Overview Tab**: Coverage score card, category breakdown, frequently asked questions
- **Gaps Tab**: Prioritized list of coverage gaps with one-tap fix buttons
- **Alerts Tab**: Active alerts with dismiss functionality
- **Circular Progress Indicator**: Visual representation of coverage percentage
- **Color-Coded Status**: Green (90%+), Amber (70-89%), Orange (50-69%), Red (<50%)
- **Coverage Badge**: Compact badge for use in other screens showing coverage %

### Conversation Summarization (NEW)

#### Auto-Generated Summaries
- **Minimum Threshold**: Summaries generated for threads with 5+ messages
- **Arrow Flow Format**: Concise summaries using flow notation (e.g., "WiFi question → sent info → positive feedback")
- **AI-Enhanced**: Longer conversations (8+ messages) use AI for more accurate summaries
- **Local Fallback**: Fast local event extraction for quick generation without API calls

#### Summary Display Locations
- **Chat Thread Header**: Full expandable summary at top of conversation
- **Hostaway-Style Reservation Summary Bar**: Fixed dark teal bar (#00695C) at top of message thread with:
  - Listing name (bold 16pt white)
  - Guest count + dates in one line (14pt gray): "12 guests · Jun 22 - Jun 28"
  - "See details" button (blue #0288D1) to open full reservation details
  - Direct message placeholder when no reservation is linked
- **Inbox Preview**: Compact summary line in conversation list items
- **Live Updates**: Summaries automatically refresh as conversation progresses

#### Event Detection
Automatically extracts key conversation events:
- **Questions**: WiFi, check-in, check-out, parking, early check-in, extensions
- **Issues**: Problems reported, maintenance requests, complaints
- **Offers**: Host offers with pricing (early check-in $30, etc.)
- **Outcomes**: Accepted, declined, resolved, sent info
- **Feedback**: Positive/negative guest responses

#### Conversation Status Tracking
Status badges showing current conversation state:
- **Inquiry** (Blue): Guest asked question, awaiting response
- **Negotiating** (Amber): Offer made, awaiting decision
- **Resolved** (Green): All questions answered, issue fixed
- **Pending Action** (Red): Open issue needs host attention
- **Follow-up** (Purple): Follow-up scheduled or needed

#### Key Points & Topics
- **Topics Extracted**: WiFi, Check-in, Parking, Amenities, Maintenance, etc.
- **Key Points**: Summarized counts (e.g., "2 questions asked", "1 issue reported")
- **Next Action**: Suggested next step for host (e.g., "Answer guest question")

#### Sentiment Analysis
- **Positive**: Happy, grateful, excited guests
- **Neutral**: Standard inquiries
- **Negative**: Frustrated, upset guests
- **Mixed**: Conversations with varied sentiment

### Real-Time Guest Sentiment Analysis (NEW)

#### Sentiment Classification
Every incoming guest message is analyzed in real-time for sentiment:
- **Positive**: Happy, grateful, satisfied guests
- **Neutral**: Standard questions and inquiries
- **Negative**: Unhappy, disappointed guests
- **Frustrated**: Guests experiencing repeated issues or delays
- **Urgent**: Time-sensitive requests needing immediate attention
- **Excited**: Enthusiastic, looking forward to their stay

#### Sentiment Badges
- **Color-Coded Display**: Each conversation shows a sentiment badge next to guest name
  - Green for Positive
  - Gray for Neutral
  - Red for Negative
  - Orange for Frustrated
  - Rose for Urgent
  - Violet for Excited
- **Icon Indicators**: Sentiment-specific icons (smile, meh, frown, alert, zap, heart)
- **Confidence Score**: Sentiment analysis includes confidence percentage

#### Auto-Prioritization
- **Inbox Sorting**: Negative/urgent conversations automatically appear at the top
- **Priority Scores**: Each sentiment has a priority level for intelligent sorting:
  - Urgent: 100
  - Frustrated: 90
  - Negative: 80
  - Excited: 40
  - Neutral: 20
  - Positive: 10
- **"Needs Attention" Tab**: Quick filter to see all negative/frustrated/urgent conversations
- **"Needs Attention" Card**: Stats card in inbox header showing count of attention-needed conversations

#### AutoPilot Sentiment Escalation
- **Automatic Escalation**: Negative sentiment triggers manual review regardless of AI confidence
- **Toggle Setting**: Enable/disable in AI Automation settings
- **Emotions Escalated**: Negative, Frustrated, Urgent, Angry, Anxious
- **Confidence Override**: Even 99% confidence drafts are escalated if sentiment is negative
- **Reason Logging**: Action logs show "Negative guest sentiment detected" for escalated messages

#### Sentiment Trends Dashboard
Accessible from Settings > AI Settings > Sentiment Trends:
- **Overview Cards**: Positive vs Negative percentage with conversation counts
- **Trend Chart**: Bar chart showing positive/negative sentiment over 7/14/30 days
- **Overall Trend Indicator**: Improving, Stable, or Declining based on historical analysis
- **Sentiment Distribution**: Visual breakdown of all sentiment types with progress bars
- **Property Breakdown**: Per-property sentiment stats with individual trends
- **Property Ranking**: Properties sorted by negative sentiment ratio for attention

#### Keyword Detection
Sentiment is detected through pattern matching:
- **Urgent Keywords**: urgent, emergency, asap, immediately, locked out, stranded
- **Frustrated Keywords**: frustrated, annoyed, disappointed, still waiting, multiple times
- **Negative Keywords**: problem, issue, broken, dirty, unhappy, refund
- **Positive Keywords**: thank, great, good, nice, lovely, appreciate, grateful
- **Excited Keywords**: excited, amazing, wonderful, can't wait, looking forward

#### Trend Calculation
- **History Analysis**: Analyzes all messages in conversation history
- **Trend Detection**: Compares first half vs second half sentiment scores
- **Improving**: Second half significantly more positive
- **Declining**: Second half significantly more negative
- **Stable**: No significant change in sentiment

### Context-Aware Response Generation (NEW)

#### Full-Thread Context Awareness
- **Chronological Analysis**: Analyzes entire conversation history in chronological order
- **Primary Focus Prioritization**: Most recent guest message is treated as the primary focus for response generation
- **Thread Direction Detection**: Classifies conversation state as:
  - **New Topic**: Fresh question not related to previous exchanges
  - **Follow-up**: Continuation of ongoing discussion
  - **Clarification**: Guest needs more explanation about previous response
  - **Resolution**: Guest acknowledging/thanking after issue resolved

#### Repetition Detection & Suppression
- **Recent Host Response Tracking**: Monitors topics addressed in last 1-3 host messages
- **Topic Matching**: Uses both exact and semantic matching to detect already-discussed topics
- **Semantic Groups**: Recognizes related terms (e.g., "WiFi", "internet", "network", "password" are all related)
- **Smart Skipping**: Topics already answered are automatically skipped unless guest explicitly asks again
- **Follow-up Detection**: Recognizes patterns like "still having issues", "didn't work", "confused about" to re-address topics

#### Confidence Adjustment for Context
- **Skipped Topics Penalty**: Confidence reduced by 5% per skipped topic (ensures human review)
- **Warning Generation**: Adds warning when topics are skipped: "Skipped X topic(s) already addressed in previous replies"
- **Thread Context Boost**: Higher confidence for clear follow-up vs new topic conversations

#### AI Reasoning Display (Enhanced)
The "How I Arrived at This" section now includes:
- **Conversation Context Step**: Shows thread direction and total exchanges
  - Thread direction: new_topic / followup / clarification / resolution
  - Total exchanges count
  - Recently covered topics list
- **Skipped Topics Step**: Lists topics not re-addressed with reasons
  - Topic name
  - Reason (e.g., "Already answered in your previous reply (1 exchange ago)")
  - Exchange count since topic was addressed
- **Color Coding**:
  - Orange for Skipped Topics (stands out for awareness)
  - Cyan for Conversation Context

#### Compact Badge Indicators
- **Skipped Topics Badge**: Orange badge in inbox showing "X skipped" when topics were not repeated
- **Quick Visual Indicator**: Helps hosts understand at a glance that AI avoided repetition

#### Prompt Engineering for Non-Repetition
AI system prompts now include:
- Explicit instructions to focus on the MOST RECENT guest message
- List of topics to NOT repeat (already addressed)
- Conversation flow guidance based on thread direction
- Instructions to only address NEW questions or explicit follow-ups

### Inbox Sorting & Activity Tracking (NEW)

#### Activity-Based Sorting
- **Most Recent Activity First**: Conversations sorted by the timestamp of the most recent activity, not just last message
- **Activity Types Tracked**:
  - Message received from guest
  - Message sent by host
  - AI draft created
  - Status changed (workflow updates)
  - Read status changed
  - Urgency changed
  - Note added to conversation
- **Real-Time Updates**: List dynamically re-sorts when any activity occurs

#### Sort By Dropdown
User-selectable sorting preference with three options:
- **Most Recent**: Default - sorts by latest activity timestamp (descending)
- **Unread First**: Prioritizes conversations with unread messages, then by timestamp
- **Urgent First**: Prioritizes by sentiment (urgent/frustrated/negative first), then by timestamp

#### Sort Preference Persistence
- Sort preference is saved to device storage
- Persists across app restarts
- Preference applies across all filter tabs (Inbox, To-Do, AI Drafts, etc.)

#### Performance Optimizations
- Uses `lastActivityTimestamp` field on each conversation for efficient sorting
- Avoids scanning all messages to find latest timestamp
- FlashList for performant virtualized rendering
- Auto-scrolls to top when sort preference changes

#### UI Integration
- Sort dropdown positioned next to filter tabs
- Compact button showing current sort option
- Bottom sheet modal with option descriptions
- Haptic feedback on selection

### Hostaway-Style Calendar Tab (REDESIGNED)

Completely redesigned to match Hostaway's mobile calendar exactly.

#### Header
- **"Calendar" Title**: Large 28pt bold title
- **Toolbar Icons**: Search, Refresh, and notification eye icon with badge
- **Teal Accent Color**: All icons use #14B8A6

#### Month Picker & View Toggle
- **Month Button**: Calendar icon + "Jan '26" format with border outline
- **Navigation Arrows**: Previous/Next month chevrons
- **Multi/Single Toggle**: Dark segmented control matching Hostaway style
  - Multi: View all listings at once
  - Single: Focus on one property with listing pill selector

#### Date Header Row
- **"Today" Label**: Fixed left column header
- **Day Format**: 3-letter day (SAT, SUN, MON) above date number
- **Today Highlight**: Current date column has teal (#14B8A6) background
- **Synchronized Scrolling**: Header scrolls with calendar grid

#### Listing Rows
- **Red Dot Indicator**: Each listing has a red dot on the left
- **Listing Name**: Bold 13pt name, truncates to 2 lines
- **Daily Prices Row**: Gray price row below each listing showing nightly rates
- **Price Format**: "199$" format matching Hostaway

#### Calendar Blocks
- **Reservation Blocks (Teal #14B8A6)**:
  - OTA badge on first day (circular with letter: A=Airbnb, B=Booking, V=Vrbo, H=Hostaway)
  - Guest name on first day
  - "• 2 guests" on second day
  - Rounded corners on start/end days
- **Block Indicators (Gray #E5E7EB)**:
  - Lock icon centered in block
  - Rounded corners on start/end

#### OTA Badge Colors
- **Airbnb**: Red #FF5A5F with "A"
- **Booking.com**: Blue #003580 with "B"
- **Vrbo**: Blue #3B82F6 with "V"
- **Hostaway/Direct**: Orange #F59E0B with "H"

#### Reservation Detail Panel
Tap any reservation to open slide-out detail:
- **Close Button**: X icon in gray circle
- **Status Badge**: Teal "Confirmed" or Gray "Blocked"
- **OTA Badge + Guest Name**: Large format with guest count below
- **Property Card**: Home icon with listing name/address
- **Date Range Card**: Check-in, nights, check-out
- **Price Card**: Green background with total price
- **Channel Card**: OTA badge with channel name

#### Real-Time Data
- **Pull-to-Refresh**: Teal spinner
- **Live Hostaway API**: Fetches from /reservations endpoint
- **Demo Mode**: Works with sample data when not connected
- **3-Month Range**: Fetches 1 month past + 2 months future

#### API Integration
- `GET /v1/reservations` - Fetch reservations with date filtering
- `GET /v1/listings` - Fetch properties if needed

#### Performance
- **Synchronized Scrolling**: Header and all rows scroll together horizontally
- **Memoized Components**: ListingCalendarRow, ReservationDetail
- **60-Day Grid**: Starts from current week's Saturday

### Intra-Thread Learning (NEW)

Real-time learning from your responses within a conversation thread, ensuring the AI evolves mid-conversation without waiting for global training.

#### Style Anchoring
After you send or edit a reply in a conversation, the AI immediately uses it as the "style anchor" for that thread:
- **Warmth Detection**: Warm, neutral, or professional tone
- **Brevity Level**: Brief (< 30 words), moderate, or detailed (80+ words)
- **Emoji Usage**: Matches whether you used emojis in this thread
- **Exclamation Usage**: Matches your punctuation style
- **Greeting Style**: Captures your greeting pattern (e.g., "Hi Sarah!")
- **Sign-off Style**: Captures your closing (e.g., "Thanks!", "Best,")
- **Key Phrases**: Extracts distinctive phrases you use (e.g., "Let me know if you need anything")

#### Thread Continuity Detection
When the guest's new message references or builds on your prior reply:
- **Reference Detection**: Identifies when guest mentions something from your last message
- **Sentiment Analysis**: Detects if guest responded positively, negatively, or neutrally to your reply
- **Suggested Acknowledgments**: Generates contextual openers like "Glad the trash info worked for you!"
- **Resolved Topic Tracking**: Tracks topics where guest confirmed/thanked after your explanation

#### Confidence Adjustments
- **+10%**: Guest positively received your last reply
- **+5%**: You have an established style in this thread
- **+5%**: Topics were previously resolved successfully
- **-15%**: Guest had issues with prior reply (more careful)

#### AI Reasoning Display
The "How I Arrived at This" section now includes:
- **Thread Style Anchor** (violet): Shows warmth, brevity, emoji/exclamation usage being matched
- **Guest References Your Reply** (green): Shows if guest referenced your message and their sentiment
- **Suggested Opener**: Contextual acknowledgment phrase when guest reacted positively

#### Badge Indicators
- **"+feedback" badge** (green): Shown when guest positively received your last reply
- **"styled" badge** (violet): Shown when AI is matching your established thread style

#### Example Flow
1. Guest: "What's the WiFi password?"
2. You: "Hi Sarah! The WiFi password is Beach2024. Let me know if you have any issues!"
3. Guest: "Thanks, that worked! One more question - where's the trash?"
4. AI Draft: "Glad the WiFi worked! Trash bins are in the garage..."
   - *Matches warm tone and exclamations from your prior reply*
   - *Acknowledges positive feedback before addressing new topic*
   - *Doesn't repeat WiFi info (already resolved)*

### Advanced AI Training System (NEW)

Comprehensive 10-feature training system to help the AI learn from your 24,000+ messages and continue improving.

#### 1. Incremental Training (Auto-train every 10 messages)
- **Automatic Learning**: Every 10 messages you send, the AI automatically trains on that batch
- **No Manual Intervention**: Training happens in the background without any user action
- **Edit Weighting**: Edited responses are weighted higher (explicitly corrected = more valuable)
- **Queue Tracking**: Dashboard shows pending messages in queue (0-10)
- **Immediate Application**: Learned patterns apply to the next AI draft

#### 2. Multi-Pass Deep Training (5 specialized passes)
- **Pass 1 - Style & Tone**: Extracts formality, warmth, and response length patterns
- **Pass 2 - Intent Mapping**: Maps guest intents to your typical response styles
- **Pass 3 - Phrase Mining**: Discovers unique phrases and expressions you use
- **Pass 4 - Contextual Patterns**: Learns property-specific and time-based patterns
- **Pass 5 - Edge Cases**: Learns how you handle complaints, refunds, and emergencies
- **Progress Tracking**: Real-time progress display for each pass
- **Resumable**: Can pause and resume training

#### 3. Property-Specific Lexicons
- **Vocabulary Extraction**: Builds a unique vocabulary for each property
- **Categories Tracked**:
  - Amenities (pool, hot tub, game room, etc.)
  - Locations (basement, loft, patio, etc.)
  - Instructions (keypad, code, button, etc.)
  - Local Recommendations (restaurant names, attractions)
- **Usage Frequency**: Tracks how often you mention each term
- **AI Enhancement**: Automatically adds property lexicon to AI prompts

#### 4. Temporal Weighting (Prioritize recent messages)
- **Age-Based Weighting**:
  - 0-6 months: 3x weight
  - 6-12 months: 2x weight
  - 12-18 months: 1x weight
  - 18+ months: 0.5x weight
- **Style Evolution Tracking**: Detects how your style changes over time
- **Quarterly Analysis**: Shows formality, warmth, and length trends per quarter
- **Adaptive Profiles**: AI uses weighted averages, prioritizing your current style

#### 5. Training Quality Dashboard
- **Coverage Analysis**: Shows which question types have strong training coverage
- **Gap Detection**: Identifies topics with few or no training examples
  - High/Medium/Low impact classification
  - Specific suggestions for each gap
- **Strengths Display**: Shows topics with high confidence (10+ examples)
- **Overall Quality Score**: 0-100% score based on coverage, diversity, reliability
- **Intent Coverage**: Tracks coverage for WiFi, check-in, parking, maintenance, etc.

#### 6. Active Learning (Pick between variations)
- **Variation Generation**: When confidence is low, AI generates 2-3 response variations
- **User Selection**: You pick the one that sounds most like you
- **Style Options**:
  - Short & Formal
  - Short & Casual
  - Long & Warm
  - Medium & Professional
- **Preference Learning**: Your choices inform future generations

#### 7. Negative Examples (What NOT to do)
- **Learn from Rejections**: When you dismiss an AI draft, the system learns why
- **Issue Categories**:
  - Too long / Too short
  - Wrong tone
  - Missing information
  - Too generic
  - Inappropriate
- **Pattern Tracking**: Groups negative examples by issue type
- **AI Prompt Injection**: Future drafts include "AVOID" instructions based on patterns
- **Better Response Storage**: When you write a better response, it's stored for reference

#### 8. Few-Shot Dynamic Examples
- **Intent-Based Index**: All your responses indexed by guest intent
- **Keyword Index**: Fast lookup by keywords in guest message
- **Dynamic Injection**: Most relevant examples injected into each AI request
- **Scoring Factors**:
  - Intent match (50 points)
  - Keyword overlap (10 points each)
  - Property match bonus (20 points)
  - Recency bonus (up to 10 points)
- **Limit Control**: Top 3 most relevant examples used per request

#### 9. Conversation Flow Learning
- **Multi-Turn Pattern Detection**: Learns typical conversation flows
  - Example: Check-in question → WiFi follow-up → Thanks
- **Flow Templates**: Stores common guest intent sequences
- **Followup Prediction**: Predicts likely next topics based on current flow
- **Property-Specific Flows**: Tracks different flows per property
- **Common Endings**: Learns how conversations typically resolve

#### 10. Guest Memory (Remember returning guests)
- **Privacy-Safe Tracking**: Uses hashed identifiers (no raw email/phone stored)
- **Multi-Property History**: Tracks which properties a guest has stayed at
- **Returning Guest Detection**: Automatically identifies repeat guests
- **Preference Storage**:
  - Has children (traveled with kids)
  - Has pets (traveled with pets)
  - Typical questions asked
  - Preferred tone (inferred)
- **AI Prompt Enhancement**: "Welcome back!" and familiar tone for returning guests
- **Stay History**: Tracks dates, properties, topics, sentiment per stay

#### Advanced Training Dashboard UI
New component accessible from AI Learning screen:
- **Quality Score Card**: Large display of overall training quality percentage
- **Incremental Status**: Shows messages queued for next training batch
- **Deep Training Controls**: Run/progress for 5-pass training
- **Gaps & Strengths**: Visual display of training gaps and strong areas
- **Learning Systems Grid**: Stats for lexicons, examples, flows, memory
- **Temporal Info**: Explanation of how recent messages are weighted
- **Negative Examples Stats**: Count of avoided patterns by issue type

#### Integration with AI Response Generation
All 10 systems automatically enhance AI responses:
- Property lexicon adds specific vocabulary to prompts
- Few-shot examples provide relevant response references
- Negative examples add "AVOID" instructions
- Guest memory adds returning guest context
- Temporal weights ensure current style is prioritized
- Conversation flows help predict and prepare for followups

#### New Files Added
- `src/lib/advanced-training.ts` - All 10 training systems implementation
- `src/components/AdvancedTrainingDashboard.tsx` - Training dashboard UI

#### Learning Hook Functions
Exported functions for other components to trigger learning:
- `learnFromSentMessage()` - Queue message for incremental training
- `learnFromRejectedDraft()` - Record negative example
- `learnFromConversation()` - Learn flows and guest memory when conversation ends
- `predictConversationFollowup()` - Get predicted next topics
- `isReturningGuest()` - Check if guest has stayed before

