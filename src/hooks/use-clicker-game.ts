'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { useSupabase } from "@/lib/supabase/provider";
import { toast } from "sonner";
import { updateClickAction } from "@/app/actions";
import { useAchievements } from "./use-achievements";
import { UserPower } from '@/types/achievement';

// Types with focused responsibilities
export interface PlayerScore {
    id: string;
    username: string;
    clicks: number;
    rank: number;
    isCurrentUser?: boolean;
}

// Click queue with batch processing
interface ClickQueueState {
    pendingClicks: number;
    isProcessing: boolean;
    lastProcessedTimestamp: number;
}

// Core hook with minimal responsibilities
export function useClickerGame() {
    // Essential state only
    const [user, setUser] = useState<User | null>(null);
    const [players, setPlayers] = useState<PlayerScore[]>([]);
    const [clickCount, setClickCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

    // Click queue state with Ref to avoid render cycles
    const clickQueueRef = useRef<ClickQueueState>({
        pendingClicks: 0,
        isProcessing: false,
        lastProcessedTimestamp: 0
    });

    // Track server-confirmed clicks separately from UI state
    const serverConfirmedClicksRef = useRef<number>(0);

    // Track user rank for achievement checking
    const userRankRef = useRef<number>(0);

    // Add a debounce ref to prevent excessive updates
    const fetchScoresDebounceRef = useRef<number | null>(null);
    const isAutoClickerActiveRef = useRef<boolean>(false);

    const supabase = useSupabase();

    // Get achievement-related functions
    const {
        checkForClickAchievements,
        checkForRankAchievements,
        getClickMultiplier,
        hasAutoClicker,
        activePowers,
        synchronizeDbPowersToMemory
    } = useAchievements();

    // 3. Data Fetching - Single Responsibility with debouncing 
    const fetchScores = useCallback(async (skipIfRecent = false) => {
        // Skip if a fetch was recently triggered and skipIfRecent is true
        if (skipIfRecent && fetchScoresDebounceRef.current) {
            return;
        }

        // Clear any existing timeout
        if (fetchScoresDebounceRef.current) {
            clearTimeout(fetchScoresDebounceRef.current);
        }

        // Set debounce flag to prevent multiple fetches in quick succession
        fetchScoresDebounceRef.current = window.setTimeout(() => {
            fetchScoresDebounceRef.current = null;
        }, 500); // 500ms debounce

        try {
            console.log('Fetching scores for leaderboard update...');

            // Get all profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username');

            if (profilesError) {
                console.error('Error fetching profiles:', profilesError);
                throw profilesError;
            }

            console.log('Fetched profiles:', profiles);

            // Get all clicks
            const { data: clicks, error: clicksError } = await supabase
                .from('clicks')
                .select('id, qty');

            if (clicksError) {
                console.error('Error fetching clicks:', clicksError);
                throw clicksError;
            }

            console.log('Fetched clicks:', clicks);

            // Update current user's click count if available
            const userClicks = clicks?.find(click => click.id === user?.id);
            if (userClicks) {
                console.log('Found user clicks:', userClicks);
                // Update the server-confirmed click count
                serverConfirmedClicksRef.current = userClicks.qty || 0;

                // Update UI with server count + any pending clicks
                setClickCount(serverConfirmedClicksRef.current + clickQueueRef.current.pendingClicks);

                // Check for click-based achievements
                if (user?.id) {
                    checkForClickAchievements(serverConfirmedClicksRef.current);
                }
            } else {
                console.log('No user clicks found in database for:', user?.id);

                // Reset to zero if user is logged in but no clicks are found
                if (user?.id) {
                    console.log('Resetting to zero + pending clicks');
                    serverConfirmedClicksRef.current = 0;
                    setClickCount(clickQueueRef.current.pendingClicks);
                }
            }

            // Make sure both profiles and clicks arrays exist before proceeding
            if (!profiles || !clicks) {
                console.warn('Missing data: profiles or clicks array is empty');
                return;
            }

            // Combine and format data
            const combinedData = profiles.map(profile => {
                const score = clicks?.find(click => click.id === profile.id);
                return {
                    id: profile.id,
                    username: profile.username || 'Anonymous',
                    clicks: score?.qty || 0,
                    rank: 0, // Will be calculated next
                    isCurrentUser: profile.id === user?.id
                };
            });

            // Sort and assign ranks
            const rankedPlayers = [...combinedData]
                .sort((a, b) => b.clicks - a.clicks)
                .map((player, index) => ({
                    ...player,
                    rank: index + 1
                }));

            console.log('Updating players state with:', rankedPlayers);

            // Find current user's rank
            const currentUserRank = rankedPlayers.find(player => player.id === user?.id)?.rank || 0;

            // If rank changed, check for rank-based achievements
            if (user?.id && currentUserRank !== userRankRef.current && currentUserRank > 0) {
                userRankRef.current = currentUserRank;
                checkForRankAchievements(currentUserRank);
            }

            setPlayers(rankedPlayers);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data");
            setIsLoading(false);
        }
    }, [supabase, user, checkForClickAchievements, checkForRankAchievements]);

    // 1. Authentication - Single Responsibility
    useEffect(() => {
        async function setupAuth() {
            try {
                console.log("Setting up auth for clicker game");

                // Try to refresh session for better auth stability
                const refreshResult = await supabase.auth.refreshSession();
                console.log("Session refresh result:", !!refreshResult.data.session);

                const { data, error } = await supabase.auth.getUser();

                if (error) {
                    console.warn("Auth warning:", error.message);
                }

                console.log("Auth user data:", data?.user?.id ? `User ${data.user.id}` : "No user");
                setUser(data.user);

                if (!data.user) {
                    toast.info("Not logged in", {
                        description: "Log in to save your progress and compete on the leaderboard",
                        duration: 5000
                    });
                }
            } catch (error) {
                console.error("Auth error:", error);
            }
        }

        setupAuth();
    }, [supabase]);

    // 2. Data Subscription - Single Responsibility with debouncing
    useEffect(() => {
        setIsLoading(true);
        console.log('Setting up real-time subscription for clicker game...');

        // Setup subscription to both tables
        const scoresChannel = supabase
            .channel('clicker-scores')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'clicks' },
                (payload) => {
                    console.log('🔴 Received real-time update for clicks:', payload);
                    console.log('Payload new value:', payload.new);

                    // Skip leaderboard refresh if auto-clicker is active and no achievement notification is showing
                    const skipIfAutoClicking = isAutoClickerActiveRef.current &&
                        !document.querySelector('[role="alert"]');

                    console.log('Triggering fetchScores due to clicks update',
                        skipIfAutoClicking ? '(debounced due to auto-clicker)' : '');

                    fetchScores(skipIfAutoClicking);
                }
            )
            // Also listen for profile changes
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                (payload) => {
                    console.log('🔵 Received real-time update for profiles:', payload);
                    console.log('Payload new value:', payload.new);
                    console.log('Triggering fetchScores due to profiles update');
                    fetchScores();
                }
            )
            .subscribe(status => {
                console.log(`Subscription status in hook: ${status}`);
                setStatus(status === 'SUBSCRIBED' ? 'connected' :
                    status === 'CHANNEL_ERROR' ? 'error' : 'connecting');
            });

        // Initial data load
        console.log('Performing initial data load for leaderboard...');
        fetchScores();

        return () => {
            console.log('Cleaning up real-time subscription');
            supabase.removeChannel(scoresChannel);
        };
    }, [supabase, fetchScores]);

    // 4. Click Queue Processing - Using Fibonacci backoff for batch timing
    const processClickQueue = useCallback(async () => {
        const queue = clickQueueRef.current;

        // Prevent concurrent processing
        if (queue.isProcessing || queue.pendingClicks === 0 || !user?.id) {
            return;
        }

        // Lock the queue for processing
        queue.isProcessing = true;

        try {
            const clicksToProcess = queue.pendingClicks;
            const newTotal = serverConfirmedClicksRef.current + clicksToProcess;

            console.log(`Processing ${clicksToProcess} clicks. Current server count: ${serverConfirmedClicksRef.current}, New total: ${newTotal}`);

            // Call the server action with the TOTAL click count
            const result = await updateClickAction(
                user.id,
                user.id,
                newTotal
            );

            if (result.success) {
                // Update server-confirmed clicks
                serverConfirmedClicksRef.current = result.newCount || newTotal;

                // Clear processed clicks from queue
                queue.pendingClicks -= clicksToProcess;

                // Update last timestamp
                queue.lastProcessedTimestamp = Date.now();
            } else {
                console.error("Batch update failed:", result.error);

                // If there's an auth issue, try to refresh the session
                if (result.error?.includes('Authentication')) {
                    const { error } = await supabase.auth.refreshSession();
                    if (!error) {
                        // Retry once after refreshing
                        const retryResult = await updateClickAction(user.id, user.id, newTotal);
                        if (retryResult.success) {
                            serverConfirmedClicksRef.current = retryResult.newCount || newTotal;
                            queue.pendingClicks -= clicksToProcess;
                            queue.lastProcessedTimestamp = Date.now();
                        } else {
                            toast.error("Update failed after refresh");
                        }
                    } else {
                        toast.error("Session refresh failed");
                    }
                } else {
                    toast.error("Failed to update score");
                }
            }
        } catch (error) {
            console.error("Click batch processing error:", error);
        } finally {
            // Unlock queue when done
            queue.isProcessing = false;

            // If there are still pending clicks, schedule next batch
            // using Fibonacci backoff timing
            if (queue.pendingClicks > 0) {
                const timeSinceLastProcess = Date.now() - queue.lastProcessedTimestamp;
                const nextBatchDelay = calculateFibonacciBackoff(timeSinceLastProcess);

                setTimeout(processClickQueue, nextBatchDelay);
            }
        }
    }, [user, supabase]);

    // Calculate Fibonacci backoff
    const calculateFibonacciBackoff = (lastDelay: number) => {
        // (a, b) => (b, a+b) - Fibonacci sequence generation
        const a = lastDelay === 0 ? 100 : lastDelay * 1.5;
        const b = lastDelay;
        const nextDelay = a + b;

        // Cap at 5 seconds
        return Math.min(nextDelay, 5000);
    };

    // Derived Data - Single Responsibility
    const currentUsername = players.find(player => player.isCurrentUser)?.username ||
        user?.email?.split('@')[0] ||
        "Anonymous Player";

    // Modify handleClickUpdate to include achievement multiplier
    const handleClickUpdate = useCallback(async () => {
        if (!user) {
            toast.error("Please log in to save your clicks");
            return;
        }

        try {
            // Get click multiplier from active powers
            const multiplier = getClickMultiplier();
            const clickValue = Math.max(1, Math.floor(multiplier));

            // Update local UI immediately for responsiveness
            const newCount = clickCount + clickValue;
            setClickCount(newCount);

            // Queue the click for server-side update
            clickQueueRef.current.pendingClicks += clickValue;

            // Process the queue if not already in progress
            if (!clickQueueRef.current.isProcessing) {
                await processClickQueue();
            }
        } catch (error) {
            console.error("Error updating clicks:", error);
            toast.error("Failed to update clicks");
        }
    }, [clickCount, user, getClickMultiplier, processClickQueue, setClickCount]);

    // Auto-clicker functionality
    useEffect(() => {
        if (!user || !hasAutoClicker() || isLoading) {
            isAutoClickerActiveRef.current = false;
            return;
        }

        // Find the auto-click power with the highest effect value
        const autoClickPower = activePowers
            .filter(up => up.power?.effect_type === 'auto_click')
            .reduce((fastest, current) => {
                const fastestValue = fastest?.power?.effect_value || 0;
                const currentValue = current.power?.effect_value || 0;
                return currentValue > fastestValue ? current : fastest;
            }, null as UserPower | null);

        if (!autoClickPower) {
            isAutoClickerActiveRef.current = false;
            return;
        }

        // Get the auto-click interval in milliseconds
        const clicksPerSecond = autoClickPower.power?.effect_value || 1;
        const interval = Math.max(100, Math.floor(1000 / clicksPerSecond));

        console.log(`Auto-clicker active: ${clicksPerSecond} clicks per second (interval: ${interval}ms)`);
        isAutoClickerActiveRef.current = true;

        // Set up interval for auto-clicking
        const autoClickInterval = setInterval(() => {
            handleClickUpdate();
        }, interval);

        return () => {
            clearInterval(autoClickInterval);
            isAutoClickerActiveRef.current = false;
        };
    }, [user, hasAutoClicker, isLoading, activePowers, handleClickUpdate]);

    // Debug: Directly check for active powers in the database and ensure they are loaded
    useEffect(() => {
        if (!user?.id) return;
        const userId = user.id; // Store this to avoid null checks

        const loadActivePowers = async () => {
            try {
                console.log('🔍 Directly checking for active powers in DB for', userId);

                // Fetch active powers directly from database
                const { data: activePowersDB, error: powersError } = await supabase
                    .from('user_powers')
                    .select(`
                        *,
                        power:power_id(*)
                    `)
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (powersError) {
                    console.error('Error checking active powers in DB:', powersError);
                    return;
                }

                console.log('📊 Active powers in DB:', activePowersDB);

                // Check for auto-clicker in DB powers
                const hasAutoClickerInDb = activePowersDB?.some(p =>
                    p.power?.effect_type === 'auto_click' ||
                    (p.power?.name?.toLowerCase().includes('auto') ||
                        p.power?.name?.toLowerCase().includes('clicker')));

                console.log('🔍 Auto-clicker in DB:', hasAutoClickerInDb);
                console.log('🔍 Auto-clicker in memory:', hasAutoClicker());

                // If we have powers in memory but not in DB, fix the DB
                if (hasAutoClicker() && !hasAutoClickerInDb) {
                    console.log('⚠️ Auto-clicker active in memory but not in DB, fixing...');

                    // Get all powers to find auto-clicker
                    const { data: allPowers, error: allPowersError } = await supabase
                        .from('special_powers')
                        .select('*')
                        .or('effect_type.eq.auto_click,name.ilike.%auto%,name.ilike.%clicker%');

                    if (allPowersError || !allPowers || allPowers.length === 0) {
                        console.error('Failed to find auto-clicker power template:', allPowersError);
                        return;
                    }

                    const autoClickerTemplate = allPowers[0];
                    console.log('🔍 Found auto-clicker template:', autoClickerTemplate);

                    // Check if user has this power
                    const { data: userPower, error: userPowerError } = await supabase
                        .from('user_powers')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('power_id', autoClickerTemplate.id)
                        .maybeSingle();

                    if (userPowerError) {
                        console.error('Error checking if user has auto-clicker:', userPowerError);
                        return;
                    }

                    // If user has the power, activate it
                    if (userPower) {
                        console.log('🔄 User has auto-clicker power, activating it');
                        const { error: updateError } = await supabase
                            .from('user_powers')
                            .update({
                                is_active: true,
                                upgrade_confirmed: true
                            })
                            .eq('id', userPower.id);

                        if (updateError) {
                            console.error('Failed to activate auto-clicker:', updateError);
                        } else {
                            console.log('✅ Auto-clicker activated in DB');
                            // Force synchronization after update
                            await synchronizeDbPowersToMemory();
                        }
                    }
                    // If user doesn't have the power, create it
                    else {
                        console.log('🆕 Creating new auto-clicker power for user');
                        const { error: createError } = await supabase
                            .from('user_powers')
                            .insert({
                                user_id: userId,
                                power_id: autoClickerTemplate.id,
                                is_active: true,
                                level: 1,
                                expires_at: null,
                                upgrade_confirmed: true
                            });

                        if (createError) {
                            console.error('Failed to create auto-clicker:', createError);
                        } else {
                            console.log('✅ Auto-clicker created and activated in DB');
                            // Force synchronization after creation
                            await synchronizeDbPowersToMemory();
                        }
                    }
                }
                // If we have powers in DB but not in memory, fix the memory state
                else if (!hasAutoClicker() && hasAutoClickerInDb) {
                    console.log('⚠️ Auto-clicker active in DB but not in memory, fixing...');

                    // Call the synchronization function to update memory state from DB
                    const synchronized = await synchronizeDbPowersToMemory();

                    if (synchronized) {
                        console.log('✅ Memory state synchronized with database');
                        // Set the auto-clicker active ref to true
                        isAutoClickerActiveRef.current = true;
                    } else {
                        console.warn('⚠️ Failed to synchronize memory state with database');
                    }
                }
            } catch (error) {
                console.error('Error ensuring active powers:', error);
            }
        };

        // Call immediately and set up interval
        loadActivePowers();
        const intervalId = setInterval(loadActivePowers, 30000); // Check every 30 seconds

        return () => clearInterval(intervalId);
    }, [user, supabase, hasAutoClicker, synchronizeDbPowersToMemory]);

    // Add a simple effect to ensure auto-clicker is activated in the database
    useEffect(() => {
        // Only run if the user is logged in and has the auto-clicker ability
        if (!user?.id || !hasAutoClicker()) return;

        const userId = user.id; // Store user ID to avoid null checks

        // Function to ensure auto-clicker is in the database
        const ensureAutoClickerInDatabase = async () => {
            try {
                console.log('🔄 Synchronizing auto-clicker state with database');

                // Find auto-clicker template
                const { data: templates, error: templatesError } = await supabase
                    .from('special_powers')
                    .select('*')
                    .or('effect_type.eq.auto_click,name.ilike.%auto%,name.ilike.%clicker%')
                    .limit(1);

                if (templatesError || !templates || templates.length === 0) {
                    console.error('❌ No auto-clicker template found:', templatesError);
                    return;
                }

                const template = templates[0];
                console.log('📋 Using auto-clicker template:', template);

                // Check if user already has this power
                const { data: userPower, error: powerError } = await supabase
                    .from('user_powers')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('power_id', template.id)
                    .maybeSingle();

                if (powerError) {
                    console.error('❌ Error checking if user has auto-clicker:', powerError);
                    return;
                }

                if (userPower) {
                    // User has the power, make sure it's active
                    if (!userPower.is_active) {
                        console.log('⚡ Auto-clicker exists but inactive, activating it');

                        const { error: updateError } = await supabase
                            .from('user_powers')
                            .update({ is_active: true })
                            .eq('id', userPower.id);

                        if (updateError) {
                            console.error('❌ Failed to activate auto-clicker:', updateError);
                        } else {
                            console.log('✅ Auto-clicker activated successfully');
                        }
                    } else {
                        console.log('✅ Auto-clicker already active in database');
                    }
                } else {
                    // User doesn't have the power, create it
                    console.log('🆕 Creating new auto-clicker power for user');

                    const { error: createError } = await supabase
                        .from('user_powers')
                        .insert({
                            user_id: userId,
                            power_id: template.id,
                            is_active: true,
                            level: 1,
                            expires_at: null
                        });

                    if (createError) {
                        console.error('❌ Failed to create auto-clicker:', createError);
                    } else {
                        console.log('✅ Auto-clicker created and activated');
                    }
                }
            } catch (error) {
                console.error('❌ Auto-clicker synchronization error:', error);
            }
        };

        // Call the function immediately when component mounts
        ensureAutoClickerInDatabase();

        // Also set up a periodic check every 60 seconds to ensure it stays synchronized
        const intervalId = setInterval(ensureAutoClickerInDatabase, 60000);

        return () => clearInterval(intervalId);
    }, [user, supabase, hasAutoClicker]);

    // Return a clean interface
    return {
        user,
        clickCount,
        userRank: userRankRef.current,
        username: currentUsername,
        allPlayers: players,
        isLoading,
        connectionStatus: status,
        handleClickUpdate,
        pendingClicks: clickQueueRef.current.pendingClicks
    };
} 