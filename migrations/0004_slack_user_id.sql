-- Add optional Slack user ID column for @mentions in Slack notifications.
-- Members without a slack_user_id will still be mentioned by name.
ALTER TABLE members ADD COLUMN slack_user_id TEXT;
