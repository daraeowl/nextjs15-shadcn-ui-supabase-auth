'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '@/lib/supabase/provider';
import { Achievement, UserAchievement } from '@/types/achievement';
import { UserPower } from '@/types/power';
import {
    checkClickAchievements,
    checkRankAchievements,
    getPendingAchievementNotifications,
    getActiveUserPowers,
    markAchievementNotified,
    getUserAchievements as getUserAchievementsAction
} from '@/app/actions/achievement-actions';
import { User } from '@supabase/supabase-js';

interface UseAchievementsResult {
    pendingAchievements: Achievement[];
    userAchievements: UserAchievement[];
    activePowers: UserPower[];
    checkForClickAchievements: (clickCount: number) => Promise<void>;
    checkForRankAchievements: (rank: number) => Promise<void>;
    markAchievementAsSeen: (achievementId: number) => Promise<void>;
    getClickMultiplier: () => number;
    hasAutoClicker: () => boolean;
    synchronizeDbPowersToMemory: () => Promise<boolean>;
}

export function useAchievements(): UseAchievementsResult {
    const [user, setUser] = useState<User | null>(null);
    const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
    const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
    const [activePowers, setActivePowers] = useState<UserPower[]>([]);
    const initRef = useRef(false);
    const achievementCheckDebounceRef = useRef<number | null>(null);
    const achievementUpdateInProgressRef = useRef(false);
    const supabase = useSupabase();

    // Fetch user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };

        getUser();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user || null);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [supabase.auth]);

    // Initialize achievements once when user loads
    useEffect(() => {
        const initAchievements = async () => {
            if (!user || initRef.current) return;

            try {
                initRef.current = true;
                console.log('Initializing achievements for user:', user.id);

                // Get user achievements
                const achievements = await getUserAchievementsAction(user.id);
                setUserAchievements(achievements);

                // Get pending notifications
                const pendingUserAchievements = await getPendingAchievementNotifications(user.id);
                const pendingAchievements = pendingUserAchievements
                    .map(ua => ua.achievement)
                    .filter((a): a is Achievement => !!a);
                setPendingAchievements(pendingAchievements);

                // Get active powers
                const powers = await getActiveUserPowers(user.id);
                setActivePowers(powers as UserPower[]);
            } catch (error) {
                console.error('Error initializing achievements:', error);
            }
        };

        initAchievements();
    }, [user]);

    // Set up real-time listeners for achievements and powers
    useEffect(() => {
        if (!user) return;

        console.log('Setting up real-time listeners for achievements and powers');

        const achievementsChannel = supabase
            .channel('achievements-channel')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_achievements',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('Real-time update for user achievements:', payload);

                    // Refresh user achievements
                    const achievements = await getUserAchievementsAction(user.id);
                    setUserAchievements(achievements);

                    // Refresh pending notifications
                    const pendingUserAchievements = await getPendingAchievementNotifications(user.id);
                    const pendingAchievements = pendingUserAchievements
                        .map(ua => ua.achievement)
                        .filter((a): a is Achievement => !!a);
                    setPendingAchievements(pendingAchievements);
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_powers',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('Real-time update for user powers:', payload);

                    // Only refresh active powers if not already processing achievements
                    if (!achievementUpdateInProgressRef.current) {
                        // Refresh active powers
                        const powers = await getActiveUserPowers(user.id);

                        // Only update state if powers have actually changed
                        if (!arePowersEqual(activePowers, powers)) {
                            console.log('Powers changed, updating state');
                            setActivePowers(powers as UserPower[]);
                        } else {
                            console.log('Powers unchanged, skipping update');
                        }
                    }
                }
            )
            .subscribe(status => {
                console.log(`Achievements channel status: ${status}`);
            });

        return () => {
            supabase.removeChannel(achievementsChannel);
        };
    }, [supabase, user, activePowers]);

    // Fetch pending achievements on user change
    useEffect(() => {
        const fetchPendingAchievements = async () => {
            if (!user) return;

            try {
                const pendingUserAchievements = await getPendingAchievementNotifications(user.id);

                // Extract achievement objects and set them
                const achievements = pendingUserAchievements
                    .map(ua => ua.achievement)
                    .filter((a): a is Achievement => !!a);

                setPendingAchievements(achievements);

                // Update user achievements list
                setUserAchievements(prev => {
                    const existingIds = new Set(prev.map(ua => ua.achievement_id));
                    const newAchievements = pendingUserAchievements.filter(ua => !existingIds.has(ua.achievement_id));
                    return [...prev, ...newAchievements];
                });
            } catch (error) {
                console.error('Error fetching pending achievements:', error);
            }
        };

        fetchPendingAchievements();
    }, [user]);

    // Check for click achievements
    const checkForClickAchievements = useCallback(async (clickCount: number) => {
        if (!user) return;

        // Skip if already checking
        if (achievementUpdateInProgressRef.current) {
            return;
        }

        // Debounce achievement checks when clicks happen rapidly
        if (achievementCheckDebounceRef.current) {
            clearTimeout(achievementCheckDebounceRef.current);
        }

        achievementCheckDebounceRef.current = window.setTimeout(async () => {
            achievementCheckDebounceRef.current = null;

            try {
                achievementUpdateInProgressRef.current = true;
                console.log(`Checking click achievements for count: ${clickCount}`);

                const newAchievements = await checkClickAchievements(user.id, clickCount);

                if (newAchievements.length > 0) {
                    // Extract achievement objects
                    const achievements = newAchievements
                        .map(ua => ua.achievement)
                        .filter((a): a is Achievement => !!a);

                    // Add to pending achievements
                    setPendingAchievements(prev => [...prev, ...achievements]);

                    // Update user achievements list
                    setUserAchievements(prev => {
                        const existingIds = new Set(prev.map(ua => ua.achievement_id));
                        const filteredNewAchievements = newAchievements.filter(ua => !existingIds.has(ua.achievement_id));
                        return [...prev, ...filteredNewAchievements];
                    });

                    // Refresh active powers
                    const powers = await getActiveUserPowers(user.id);
                    setActivePowers(powers);
                }
            } catch (error) {
                console.error('Error checking click achievements:', error);
            } finally {
                achievementUpdateInProgressRef.current = false;
            }
        }, 500); // 500ms debounce
    }, [user]);

    // Check for rank achievements
    const checkForRankAchievements = useCallback(async (rank: number) => {
        if (!user) return;

        // Don't check rank achievements during auto-clicks to avoid unnecessary processing
        if (achievementUpdateInProgressRef.current) {
            return;
        }

        // Use a similar debounce pattern as click achievements
        if (achievementCheckDebounceRef.current) {
            clearTimeout(achievementCheckDebounceRef.current);
        }

        achievementCheckDebounceRef.current = window.setTimeout(async () => {
            achievementCheckDebounceRef.current = null;

            try {
                achievementUpdateInProgressRef.current = true;
                console.log(`Checking rank achievements for rank: ${rank}`);

                const newAchievements = await checkRankAchievements(user.id, rank);

                if (newAchievements.length > 0) {
                    // Extract achievement objects
                    const achievements = newAchievements
                        .map(ua => ua.achievement)
                        .filter((a): a is Achievement => !!a);

                    // Add to pending achievements
                    setPendingAchievements(prev => [...prev, ...achievements]);

                    // Update user achievements list
                    setUserAchievements(prev => {
                        const existingIds = new Set(prev.map(ua => ua.achievement_id));
                        const filteredNewAchievements = newAchievements.filter(ua => !existingIds.has(ua.achievement_id));
                        return [...prev, ...filteredNewAchievements];
                    });

                    // Refresh active powers
                    const powers = await getActiveUserPowers(user.id);
                    setActivePowers(powers);
                }
            } catch (error) {
                console.error('Error checking rank achievements:', error);
            } finally {
                achievementUpdateInProgressRef.current = false;
            }
        }, 500); // 500ms debounce
    }, [user]);

    // Mark achievement as seen
    const markAchievementAsSeen = useCallback(async (achievementId: number) => {
        if (!user) return;

        try {
            const success = await markAchievementNotified(user.id, achievementId);

            if (success) {
                // Remove from pending achievements
                setPendingAchievements(prev =>
                    prev.filter(a => a.id !== achievementId)
                );
            }
        } catch (error) {
            console.error('Error marking achievement as seen:', error);
        }
    }, [user]);

    // Calculate click multiplier from active powers
    const getClickMultiplier = useCallback(() => {
        const multiplierPowers = activePowers
            .filter(up => up.power?.effect_type === 'multiplier')
            .map(up => up.power?.effect_value || 1);

        if (multiplierPowers.length === 0) return 1;

        // Apply all multipliers
        return multiplierPowers.reduce((total, multiplier) => total * multiplier, 1);
    }, [activePowers]);

    // Check if user has auto clicker
    const hasAutoClicker = useCallback(() => {
        return activePowers.some(up => up.power?.effect_type === 'auto_click');
    }, [activePowers]);

    // Synchronize database powers to memory state
    const synchronizeDbPowersToMemory = useCallback(async () => {
        if (!user) return false;

        // Optimized function to fetch powers from DB using only the RPC method
        const fetchPowersFromDB = async (userId: string) => {
            if (!userId) return [];

            console.log('🔄 Fetching powers from DB for', userId);

            try {
                // Use the RPC function method which is proven to work reliably
                const { data: rpcPowers, error: rpcError } = await supabase.rpc('get_active_powers', {
                    user_id_param: userId
                });

                if (rpcError) {
                    console.error('❌ RPC error when fetching powers:', rpcError);
                    return [];
                }

                if (rpcPowers && rpcPowers.length > 0) {
                    console.log(`✅ Found ${rpcPowers.length} active powers via RPC method`);
                    return rpcPowers;
                }

                console.log('❌ No active powers found');
                return [];
            } catch (error) {
                console.error('❌ Exception in fetchPowersFromDB:', error);
                return [];
            }
        };

        try {
            console.log('🔄 Synchronizing powers from database to memory...');

            // Use fetchPowersFromDB directly which has multiple methods to find powers
            const latestPowers = await fetchPowersFromDB(user.id);
            console.log('📊 Latest powers from DB:', latestPowers);

            // Look for auto-clicker in the DB powers
            const hasAutoClickerInDb = latestPowers.some((up: UserPower) =>
                up.power?.effect_type === 'auto_click' ||
                (up.power?.name?.toLowerCase().includes('auto') ||
                    up.power?.name?.toLowerCase().includes('clicker')) &&
                up.is_active === true
            );

            console.log('🔍 Auto-clicker in DB:', hasAutoClickerInDb);
            console.log('🔍 Auto-clicker in memory:', hasAutoClicker());

            // If we have any powers in DB but none in memory, update memory
            if (latestPowers.length > 0 && activePowers.length === 0) {
                console.log('✅ Found powers in DB but not in memory, updating memory state');
                setActivePowers(latestPowers as UserPower[]);
                return true;
            }

            // If we have an active auto-clicker in DB but not in memory, update memory
            if (hasAutoClickerInDb && !hasAutoClicker()) {
                console.log('✅ Auto-clicker found in DB but not in memory, updating memory state');
                setActivePowers(latestPowers as UserPower[]);
                return true;
            }

            // If we have an auto-clicker in memory but not in DB (or it's not active), make a direct API call
            if (!hasAutoClickerInDb && hasAutoClicker()) {
                console.log('⚠️ Auto-clicker in memory but not active in DB, calling sync API');
                try {
                    // Call the sync-powers API endpoint to ensure DB state is correct
                    const response = await fetch('/api/sync-powers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('📊 Sync API result:', result);

                        // Refresh powers from DB after sync
                        const refreshedPowers = await fetchPowersFromDB(user.id);
                        setActivePowers(refreshedPowers as UserPower[]);
                        return true;
                    } else {
                        console.error('❌ Sync API error:', await response.text());
                    }
                } catch (syncError) {
                    console.error('❌ Error calling sync API:', syncError);
                }
                return false;
            }

            // Update powers if they're different
            if (!arePowersEqual(activePowers, latestPowers)) {
                console.log('🔄 Powers in DB differ from memory, updating memory state');
                console.log('Memory powers:', activePowers);
                console.log('DB powers:', latestPowers);
                setActivePowers(latestPowers as UserPower[]);
                return true;
            }

            console.log('✅ Powers are in sync');
            return true;
        } catch (error) {
            console.error('❌ Error synchronizing powers from DB:', error);
            return false;
        }
    }, [user, activePowers, hasAutoClicker, supabase, setActivePowers]);

    // Add a helper function to compare powers arrays
    const arePowersEqual = (powers1: UserPower[], powers2: UserPower[]) => {
        if (!powers1 || !powers2) return false;
        if (powers1.length !== powers2.length) return false;

        // Create map of powers by ID for faster lookup
        const powerMap = new Map(powers1.map(p => [p.id, p]));

        // Check if all powers in powers2 match those in powers1
        return powers2.every(p2 => {
            const p1 = powerMap.get(p2.id);
            if (!p1) return false;

            // Compare required fields
            if (p1.is_active !== p2.is_active ||
                p1.power_id !== p2.power_id ||
                p1.upgrade_confirmed !== p2.upgrade_confirmed) {
                return false;
            }

            // Compare optional fields if they exist
            const level1 = p1.level ?? 1;
            const level2 = p2.level ?? 1;

            return level1 === level2;
        });
    };

    // Add synchronization on component mount and when user changes
    useEffect(() => {
        if (user) {
            console.log('🔄 Initial power sync triggered...');
            synchronizeDbPowersToMemory();

            // Set up an interval to sync powers every 30 seconds
            const syncInterval = setInterval(() => {
                console.log('🔄 Interval power sync triggered...');
                synchronizeDbPowersToMemory();
            }, 30000);

            return () => clearInterval(syncInterval);
        }
    }, [user, synchronizeDbPowersToMemory]);

    return {
        pendingAchievements,
        userAchievements,
        activePowers,
        checkForClickAchievements,
        checkForRankAchievements,
        markAchievementAsSeen,
        getClickMultiplier,
        hasAutoClicker,
        synchronizeDbPowersToMemory
    };
} 