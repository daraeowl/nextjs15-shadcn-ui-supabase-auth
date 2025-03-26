-- This script sets up triggers to automatically grant powers to users at specific milestones
-- regardless of achievements

-- First, let's create a function to grant powers to users
CREATE OR REPLACE FUNCTION grant_power_to_user(
    p_user_id UUID,
    p_power_id INTEGER
) RETURNS VOID AS $$
DECLARE
    power_exists BOOLEAN;
    power_duration INTEGER;
    power_max_level INTEGER;
BEGIN
    -- Check if user already has this power
    SELECT EXISTS(
        SELECT 1 FROM user_powers 
        WHERE user_id = p_user_id AND power_id = p_power_id
    ) INTO power_exists;
    
    -- If user doesn't have the power, grant it
    IF NOT power_exists THEN
        -- Get the power duration and max_level if available
        SELECT duration, max_level INTO power_duration, power_max_level 
        FROM special_powers 
        WHERE id = p_power_id;
        
        -- Insert the power with appropriate expiration (NULL if permanent)
        INSERT INTO user_powers (
            user_id, 
            power_id, 
            acquired_at, 
            expires_at, 
            is_active, 
            uses_left,
            level,
            upgrade_confirmed
        ) VALUES (
            p_user_id, 
            p_power_id, 
            NOW(), 
            CASE 
                WHEN power_duration IS NOT NULL THEN NOW() + (power_duration * INTERVAL '1 second')
                ELSE NULL
            END,
            TRUE, 
            NULL,
            1,
            FALSE
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if user should get powers based on click count
CREATE OR REPLACE FUNCTION check_power_milestones() RETURNS TRIGGER AS $$
DECLARE
    click_count INTEGER;
BEGIN
    -- Get user's click count
    click_count := NEW.qty;
    
    -- Grant powers based on click count milestones
    -- You can adjust these thresholds as needed
    
    -- At 100 clicks - Grant a common power (Double Trouble)
    IF click_count >= 100 AND click_count < 110 THEN
        PERFORM grant_power_to_user(NEW.user_id, 1); -- ID 1 is Double Trouble
    END IF;
    
    -- At 500 clicks - Grant an uncommon power (Triple Threat)
    IF click_count >= 500 AND click_count < 510 THEN
        PERFORM grant_power_to_user(NEW.user_id, 2); -- ID 2 is Triple Threat
    END IF;
    
    -- At 1,000 clicks - Grant a rare power (Quadra Power)
    IF click_count >= 1000 AND click_count < 1010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 3); -- ID 3 is Quadra Power
    END IF;
    
    -- At 5,000 clicks - Grant an epic power (Penta Power)
    IF click_count >= 5000 AND click_count < 5010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 4); -- ID 4 is Penta Power
    END IF;
    
    -- At 10,000 clicks - Grant a legendary power (Deca Power)
    IF click_count >= 10000 AND click_count < 10010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 5); -- ID 5 is Deca Power
    END IF;
    
    -- At 1,000 clicks - Grant a common auto-clicker (Helping Hand)
    IF click_count >= 1000 AND click_count < 1010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 6); -- ID 6 is Helping Hand
    END IF;
    
    -- At 2,500 clicks - Grant an uncommon auto-clicker (Busy Hands)
    IF click_count >= 2500 AND click_count < 2510 THEN
        PERFORM grant_power_to_user(NEW.user_id, 7); -- ID 7 is Busy Hands
    END IF;
    
    -- At 5,000 clicks - Grant a rare auto-clicker (Many Hands)
    IF click_count >= 5000 AND click_count < 5010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 8); -- ID 8 is Many Hands
    END IF;
    
    -- At 10,000 clicks - Grant an epic auto-clicker (Hundred Hands)
    IF click_count >= 10000 AND click_count < 10010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 9); -- ID 9 is Hundred Hands
    END IF;
    
    -- At 25,000 clicks - Grant a legendary auto-clicker (Thousand Hands)
    IF click_count >= 25000 AND click_count < 25010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 10); -- ID 10 is Thousand Hands
    END IF;
    
    -- At 2,000 clicks - Grant a common permanent upgrade (Steady Hand)
    IF click_count >= 2000 AND click_count < 2010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 11); -- ID 11 is Steady Hand
    END IF;
    
    -- At 5,000 clicks - Grant an uncommon permanent upgrade (Reinforced Click)
    IF click_count >= 5000 AND click_count < 5010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 12); -- ID 12 is Reinforced Click
    END IF;
    
    -- At 10,000 clicks - Grant a rare permanent upgrade (Enhanced Click)
    IF click_count >= 10000 AND click_count < 10010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 13); -- ID 13 is Enhanced Click
    END IF;
    
    -- At 25,000 clicks - Grant an epic permanent upgrade (Supercharged Click)
    IF click_count >= 25000 AND click_count < 25010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 14); -- ID 14 is Supercharged Click
    END IF;
    
    -- At 50,000 clicks - Grant a legendary permanent upgrade (Godly Click)
    IF click_count >= 50000 AND click_count < 50010 THEN
        PERFORM grant_power_to_user(NEW.user_id, 15); -- ID 15 is Godly Click
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the clicks table
DROP TRIGGER IF EXISTS check_power_milestones_trigger ON clicks;
CREATE TRIGGER check_power_milestones_trigger
AFTER UPDATE OF qty ON clicks
FOR EACH ROW
EXECUTE FUNCTION check_power_milestones();

-- Create or update an SQL function to activate powers
CREATE OR REPLACE FUNCTION activate_user_power(
    p_user_id UUID,
    p_power_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    power_exists BOOLEAN;
    power_active BOOLEAN;
    power_expired BOOLEAN;
    power_uses INTEGER;
    power_level INTEGER;
    power_max_level INTEGER;
BEGIN
    -- Check if user has this power
    SELECT EXISTS(
        SELECT 1 FROM user_powers 
        WHERE user_id = p_user_id AND power_id = p_power_id
    ) INTO power_exists;
    
    -- If user doesn't have the power, return false
    IF NOT power_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Get power level and max level
    SELECT up.level, sp.max_level INTO power_level, power_max_level
    FROM user_powers up
    JOIN special_powers sp ON up.power_id = sp.id
    WHERE up.user_id = p_user_id AND up.power_id = p_power_id;
    
    -- Check if power is already active
    SELECT is_active INTO power_active
    FROM user_powers
    WHERE user_id = p_user_id AND power_id = p_power_id;
    
    -- Check if power has expired (if not at max level)
    IF power_level < power_max_level THEN
        SELECT CASE 
            WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN TRUE 
            ELSE FALSE 
        END INTO power_expired
        FROM user_powers
        WHERE user_id = p_user_id AND power_id = p_power_id;
    ELSE
        -- At max level, power never expires
        power_expired := FALSE;
    END IF;
    
    -- Check if power has uses left
    SELECT uses_left INTO power_uses
    FROM user_powers
    WHERE user_id = p_user_id AND power_id = p_power_id;
    
    -- If power is not active, not expired, and has uses left (or uses is NULL), activate it
    IF NOT power_active AND NOT power_expired AND (power_uses IS NULL OR power_uses > 0) THEN
        UPDATE user_powers
        SET is_active = TRUE,
            uses_left = CASE WHEN uses_left IS NOT NULL THEN uses_left - 1 ELSE NULL END
        WHERE user_id = p_user_id AND power_id = p_power_id;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to upgrade a power with user confirmation
CREATE OR REPLACE FUNCTION upgrade_user_power(
    p_user_id UUID,
    p_power_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    power_exists BOOLEAN;
    power_level INTEGER;
    power_max_level INTEGER;
    power_duration INTEGER;
    requires_confirmation BOOLEAN;
BEGIN
    -- Check if user has this power
    SELECT EXISTS(
        SELECT 1 FROM user_powers 
        WHERE user_id = p_user_id AND power_id = p_power_id
    ) INTO power_exists;
    
    -- If user doesn't have the power, return false
    IF NOT power_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Get current level, max level, duration, and confirmation requirement
    SELECT up.level, sp.max_level, sp.duration, sp.requires_confirmation
    INTO power_level, power_max_level, power_duration, requires_confirmation
    FROM user_powers up
    JOIN special_powers sp ON up.power_id = sp.id
    WHERE up.user_id = p_user_id AND up.power_id = p_power_id;
    
    -- Check if power can be upgraded
    IF power_level >= power_max_level THEN
        RETURN FALSE; -- Already at max level
    END IF;
    
    -- Check if user confirmation is required
    IF requires_confirmation AND NOT EXISTS(
        SELECT 1 FROM user_powers
        WHERE user_id = p_user_id AND power_id = p_power_id AND upgrade_confirmed = TRUE
    ) THEN
        RETURN FALSE; -- Requires confirmation but not confirmed yet
    END IF;
    
    -- Upgrade the power
    UPDATE user_powers
    SET level = level + 1,
        upgrade_confirmed = FALSE, -- Reset confirmation for next upgrade
        expires_at = CASE 
            -- If at max level after upgrade, make it unlimited
            WHEN (level + 1) >= power_max_level THEN NULL
            -- Otherwise, extend duration
            WHEN power_duration IS NOT NULL THEN NOW() + (power_duration * level * INTERVAL '1 second')
            ELSE NULL
        END
    WHERE user_id = p_user_id AND power_id = p_power_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to confirm power upgrade
CREATE OR REPLACE FUNCTION confirm_power_upgrade(
    p_user_id UUID,
    p_power_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    power_exists BOOLEAN;
BEGIN
    -- Check if user has this power
    SELECT EXISTS(
        SELECT 1 FROM user_powers 
        WHERE user_id = p_user_id AND power_id = p_power_id
    ) INTO power_exists;
    
    -- If user doesn't have the power, return false
    IF NOT power_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Set upgrade_confirmed to TRUE
    UPDATE user_powers
    SET upgrade_confirmed = TRUE
    WHERE user_id = p_user_id AND power_id = p_power_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update special_powers categories based on functionality
-- This is a one-time update for existing powers
UPDATE special_powers
SET category = CASE
    -- Multiplier powers (ID 1-5) are considered "buff" type
    WHEN id BETWEEN 1 AND 5 THEN 'buff'
    -- Auto-clicker powers (ID 6-10) are considered "support" type
    WHEN id BETWEEN 6 AND 10 THEN 'support'
    -- Permanent upgrades (ID 11-15) are considered "attack" type
    WHEN id BETWEEN 11 AND 15 THEN 'attack'
    ELSE 'buff' -- Default category
END; 