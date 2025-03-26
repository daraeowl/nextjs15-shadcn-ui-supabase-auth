'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { useSupabase } from "@/lib/supabase/provider";
import { toast } from "sonner";
import { updateClickAction } from "@/app/actions";

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

    const supabase = useSupabase();

    // 3. Data Fetching - Single Responsibility 
    const fetchScores = useCallback(async () => {
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
            setPlayers(rankedPlayers);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data");
            setIsLoading(false);
        }
    }, [supabase, user]);

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

    // 2. Data Subscription - Single Responsibility
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
                    console.log('Triggering fetchScores due to clicks update');
                    fetchScores();
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

    // Helper function for Fibonacci backoff calculation
    const calculateFibonacciBackoff = (lastDelay: number) => {
        // Start with a minimum 200ms delay
        if (lastDelay < 200) return 200;

        // Calculate Fibonacci sequence: each number is the sum of the two preceding ones
        // This gives us: 200, 300, 500, 800, 1300, 2100, 3400, etc.
        const a = Math.floor(lastDelay * 0.618); // Golden ratio approximation
        const b = lastDelay;
        const nextDelay = a + b;

        // Cap at 5 seconds
        return Math.min(nextDelay, 5000);
    };

    // 5. Click Handler - Now just queues clicks and triggers processing
    const handleClick = useCallback(() => {
        if (!user?.id) {
            toast.error("Authentication required", {
                description: "Please log in to play"
            });
            return;
        }

        console.log('Click registered', {
            currentCount: clickCount,
            serverConfirmed: serverConfirmedClicksRef.current,
            pendingBefore: clickQueueRef.current.pendingClicks
        });

        // Increment pending clicks counter
        clickQueueRef.current.pendingClicks++;

        // Update UI immediately for responsive feel - make sure to use functional update
        setClickCount(prevCount => prevCount + 1);

        console.log('After click', {
            pendingAfter: clickQueueRef.current.pendingClicks,
            isProcessing: clickQueueRef.current.isProcessing
        });

        // Process queue if not already processing
        if (!clickQueueRef.current.isProcessing) {
            processClickQueue();
        }
    }, [user, processClickQueue, clickCount]);

    // 6. Derived Data - Single Responsibility
    const currentUserRank = players.find(player => player.isCurrentUser)?.rank || 0;
    const currentUsername = players.find(player => player.isCurrentUser)?.username ||
        user?.email?.split('@')[0] ||
        "Anonymous Player";

    // Return a clean interface
    return {
        user,
        clickCount,
        userRank: currentUserRank,
        username: currentUsername,
        allPlayers: players,
        isLoading,
        connectionStatus: status,
        handleClickUpdate: handleClick,
        pendingClicks: clickQueueRef.current.pendingClicks
    };
} 