-- Script to generate 50 achievements
-- Clear existing achievements but keep the first two
DELETE FROM achievements WHERE id > 2;

-- Reset the sequence to continue from the last ID
SELECT setval('achievements_id_seq', (SELECT MAX(id) FROM achievements), true);

-- Click-based achievements (common to legendary)
INSERT INTO achievements (name, description, icon, rarity, threshold, type, reward_type, reward_value)
VALUES
-- Common (clicks 1-100)
('Click Apprentice', 'Reach 25 clicks', 'mouse-pointer', 'common', 25, 'clicks', 'none', NULL),
('Click Adept', 'Reach 50 clicks', 'mouse-pointer', 'common', 50, 'clicks', 'multiplier', 1.1),
('Click Expert', 'Reach 100 clicks', 'mouse-pointer', 'common', 100, 'clicks', 'multiplier', 1.2),

-- Uncommon (clicks 250-1000)
('Click Master', 'Reach 250 clicks', 'mouse-pointer', 'uncommon', 250, 'clicks', 'multiplier', 1.3),
('Click Virtuoso', 'Reach 500 clicks', 'mouse-pointer', 'uncommon', 500, 'clicks', 'multiplier', 1.4),
('Click Champion', 'Reach 1,000 clicks', 'zap', 'uncommon', 1000, 'clicks', 'multiplier', 1.5),

-- Rare (clicks 2500-10000)
('Click Prodigy', 'Reach 2,500 clicks', 'zap', 'rare', 2500, 'clicks', 'multiplier', 1.6),
('Click Legend', 'Reach 5,000 clicks', 'zap', 'rare', 5000, 'clicks', 'multiplier', 1.75),
('Click Mystic', 'Reach 10,000 clicks', 'sparkles', 'rare', 10000, 'clicks', 'multiplier', 2.0),

-- Epic (clicks 25000-100000)
('Click Demigod', 'Reach 25,000 clicks', 'sparkles', 'epic', 25000, 'clicks', 'auto_click', 1),
('Click Deity', 'Reach 50,000 clicks', 'crown', 'epic', 50000, 'clicks', 'auto_click', 2),
('Click Immortal', 'Reach 100,000 clicks', 'crown', 'epic', 100000, 'clicks', 'auto_click', 5),

-- Legendary (clicks 250000-1000000)
('Click Transcendent', 'Reach 250,000 clicks', 'star', 'legendary', 250000, 'clicks', 'auto_click', 10),
('Click Cosmic', 'Reach 500,000 clicks', 'sun', 'legendary', 500000, 'clicks', 'auto_click', 15),
('Click Universal', 'Reach 1,000,000 clicks', 'infinity', 'legendary', 1000000, 'clicks', 'multiplier', 5.0),

-- Rank-based achievements
-- Common ranks
('Rank Novice', 'Reach rank 2', 'arrow-up', 'common', 2, 'rank', 'multiplier', 1.1),
('Rank Apprentice', 'Reach rank 3', 'arrow-up', 'common', 3, 'rank', 'multiplier', 1.2),
('Rank Adept', 'Reach rank 5', 'arrow-up', 'common', 5, 'rank', 'multiplier', 1.3),

-- Uncommon ranks
('Rank Expert', 'Reach rank 10', 'award', 'uncommon', 10, 'rank', 'multiplier', 1.5),
('Rank Master', 'Reach rank 15', 'award', 'uncommon', 15, 'rank', 'multiplier', 1.75),
('Rank Champion', 'Reach rank 25', 'award', 'uncommon', 25, 'rank', 'auto_click', 1),

-- Rare ranks
('Rank Virtuoso', 'Reach rank 40', 'trophy', 'rare', 40, 'rank', 'auto_click', 2),
('Rank Prodigy', 'Reach rank 60', 'trophy', 'rare', 60, 'rank', 'auto_click', 3),
('Rank Legend', 'Reach rank 85', 'trophy', 'rare', 85, 'rank', 'multiplier', 2.5),

-- Epic ranks
('Rank Mythos', 'Reach rank 100', 'gem', 'epic', 100, 'rank', 'auto_click', 5),
('Rank Demigod', 'Reach rank 150', 'gem', 'epic', 150, 'rank', 'multiplier', 3.0),
('Rank Deity', 'Reach rank 200', 'gem', 'epic', 200, 'rank', 'auto_click', 7),

-- Legendary ranks
('Rank Immortal', 'Reach rank 250', 'crown', 'legendary', 250, 'rank', 'multiplier', 4.0),
('Rank Transcendent', 'Reach rank 300', 'crown', 'legendary', 300, 'rank', 'auto_click', 10),
('Rank Cosmic', 'Reach rank 500', 'sun', 'legendary', 500, 'rank', 'multiplier', 5.0),

-- Click Speed achievements
('Quick Clicker', 'Click 10 times in 5 seconds', 'clock', 'common', 10, 'click_speed', 'multiplier', 1.2),
('Speed Demon', 'Click 20 times in 5 seconds', 'clock', 'uncommon', 20, 'click_speed', 'multiplier', 1.5),
('Lightning Hands', 'Click 30 times in 5 seconds', 'zap', 'rare', 30, 'click_speed', 'multiplier', 2.0),
('Sonic Clicker', 'Click 40 times in 5 seconds', 'zap', 'epic', 40, 'click_speed', 'auto_click', 3),
('Speed of Light', 'Click 50 times in 5 seconds', 'sparkles', 'legendary', 50, 'click_speed', 'auto_click', 10);

-- Insert special powers if they don't exist already
INSERT INTO special_powers (name, description, effect_type, effect_value, duration, icon, rarity)
VALUES
-- Multipliers
('Double Trouble', 'Double your clicks for 1 minute', 'multiplier', 2.0, 60, 'flame', 'common'),
('Triple Threat', 'Triple your clicks for 1 minute', 'multiplier', 3.0, 60, 'flame', 'uncommon'),
('Quadra Power', 'Quadruple your clicks for 1 minute', 'multiplier', 4.0, 60, 'flame', 'rare'),
('Penta Power', 'Multiply your clicks by 5 for 1 minute', 'multiplier', 5.0, 60, 'flame', 'epic'),
('Deca Power', 'Multiply your clicks by 10 for 1 minute', 'multiplier', 10.0, 60, 'flame', 'legendary'),

-- Auto Clickers
('Helping Hand', 'Auto-click once per second for 2 minutes', 'auto_click', 1, 120, 'hand', 'common'),
('Busy Hands', 'Auto-click 3 times per second for 2 minutes', 'auto_click', 3, 120, 'hand', 'uncommon'),
('Many Hands', 'Auto-click 5 times per second for 2 minutes', 'auto_click', 5, 120, 'hand', 'rare'),
('Hundred Hands', 'Auto-click 10 times per second for 2 minutes', 'auto_click', 10, 120, 'hand', 'epic'),
('Thousand Hands', 'Auto-click 20 times per second for 2 minutes', 'auto_click', 20, 120, 'hand', 'legendary'),

-- Permanent upgrades
('Steady Hand', 'Permanently increase base click value by 1', 'permanent', 1, NULL, 'hand-metal', 'common'),
('Reinforced Click', 'Permanently increase base click value by 2', 'permanent', 2, NULL, 'hand-metal', 'uncommon'),
('Enhanced Click', 'Permanently increase base click value by 5', 'permanent', 5, NULL, 'hand-metal', 'rare'),
('Supercharged Click', 'Permanently increase base click value by 10', 'permanent', 10, NULL, 'hand-metal', 'epic'),
('Godly Click', 'Permanently increase base click value by 25', 'permanent', 25, NULL, 'hand-metal', 'legendary'); 