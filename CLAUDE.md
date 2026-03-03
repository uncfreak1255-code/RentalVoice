# RentalVoice — AI Guest Messaging

## What This Is
AI-powered guest messaging system trained on 23,000+ historical messages from Seascape Vacations.
Handles automated responses with human-in-the-loop approval via Flask dashboards.

## Tech Stack
- Python/Flask backend
- Hostaway API integration (OAuth2, conversations endpoint)
- Supabase database (project: Rental Voice, us-east-1, currently INACTIVE)
- Flask approval dashboards for human review

## Key Integrations
- Hostaway API: OAuth2 auth, conversations/messages endpoints
- Message classification: intent detection, urgency scoring
- Response generation: context-aware replies based on property + guest history

## Architecture
- Message ingestion from Hostaway webhooks
- AI classification → response generation → approval queue
- Human approves/edits → sends via Hostaway API
- All interactions logged for training data

## Development Notes
- Supabase project needs to be restored (currently INACTIVE)
- Historical message corpus: 23K+ messages for fine-tuning/RAG
- Rate limiting: respect Hostaway API limits, token refresh patterns

## Skills
Read skills: hostaway-api, api-patterns, python-patterns, database-design
