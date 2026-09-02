-- Discord bot accounts (Raid-Helper itself, music bots, etc.) show up in guild.members.fetch()
-- just like real members, with 0% everywhere since they never sign up for raids. That created a
-- huge tie block at the bottom of every ranking. Track and exclude them at the source.
ALTER TABLE members ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
