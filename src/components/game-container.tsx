'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabase } from '@/lib/supabase/provider';
import PlayerStats from '@/components/player-stats';
import ActivePowers from '@/components/active-powers';
import Leaderboard from "@/components/leaderboard";
import ConnectionStatus from "@/components/connection-status";
import { useClickerGame } from "@/hooks/use-clicker-game";
import { useAchievements } from "@/hooks/use-achievements";
import { Badge } from '@/components/ui/badge';
import { AchievementNotificationManager } from '@/components/achievement-notification-manager';

export default function GameContainer() {
    const {
        user,
        clickCount,
        userRank,
        username,
        isLoading,
        connectionStatus,
        allPlayers,
        handleClickUpdate
    } = useClickerGame();

    // Get user achievements data
    const { userAchievements, activePowers, getClickMultiplier } = useAchievements();

    // Get the current user ID
    const supabase = useSupabase();
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [gameStarted, setGameStarted] = useState(false);

    // Fetch current user ID on mount
    useEffect(() => {
        const fetchUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user) {
                setUserId(data.user.id);
            }
        };

        fetchUser();
    }, [supabase]);

    // Calculate the bonus
    const clickMultiplier = getClickMultiplier();
    const hasBonus = clickMultiplier > 1;

    // Get the click value
    const clickValue = Math.max(1, Math.floor(clickMultiplier));

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Clicker Game</h1>
                <p className="text-slate-600">Click as fast as you can to climb the leaderboard!</p>
            </div>

            {/* Achievement notification manager for showing toasts */}
            <AchievementNotificationManager />

            {!gameStarted ? (
                <Card className="p-6 max-w-md mx-auto text-center">
                    <h2 className="text-xl font-semibold mb-4">Ready to play?</h2>
                    <p className="mb-6 text-slate-600">Click the button below to start the game</p>
                    <Button
                        size="lg"
                        onClick={() => setGameStarted(true)}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                        Start Game
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="p-4 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Game Area</h2>
                            </div>
                            <div className="flex-grow flex items-center justify-center">
                                <Button
                                    size="lg"
                                    className="w-3/4 h-16 text-xl"
                                    onClick={async () => {
                                        await handleClickUpdate();
                                    }}
                                >
                                    Click Me!
                                </Button>
                            </div>
                        </Card>

                        {user && (
                            <Card className="p-4 mt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold">Achievements</h2>
                                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                        {userAchievements.length} Unlocked
                                    </Badge>
                                </div>

                                {userAchievements.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                                                <div className="text-2xl font-bold">{userAchievements.length}</div>
                                                <div className="text-sm text-muted-foreground">Unlocked</div>
                                            </div>
                                            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                <div className="text-2xl font-bold">{activePowers.length}</div>
                                                <div className="text-sm text-muted-foreground">Active Powers</div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <h3 className="text-sm font-medium mb-2">Recent Achievements</h3>
                                            <div className="space-y-2">
                                                {userAchievements.slice(0, 3).map(achievement => (
                                                    <div
                                                        key={achievement.id}
                                                        className="flex items-center p-2 rounded-md bg-slate-50 border border-slate-100"
                                                    >
                                                        <span className="text-lg mr-2">{achievement.achievement?.icon || '🏆'}</span>
                                                        <div>
                                                            <div className="font-medium text-sm">{achievement.achievement?.name || 'Achievement'}</div>
                                                            <div className="text-xs text-slate-500">{achievement.achievement?.description}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-8 text-slate-500">
                                        No achievements unlocked yet. Keep clicking!
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    <div>
                        <Card className="p-4 mb-6">
                            <h2 className="text-xl font-semibold mb-4">Your Stats</h2>
                            <PlayerStats
                                clickCount={clickCount}
                                rank={userRank}
                                username={username}
                                loading={isLoading}
                                onClickButton={async () => {
                                    await handleClickUpdate();
                                }}
                                clickValue={clickValue}
                                hasBonus={hasBonus}
                                userId={userId}
                            />
                        </Card>

                        <Card className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Active Powers</h2>
                                {activePowers.length > 0 && (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                        {activePowers.length} Active
                                    </Badge>
                                )}
                            </div>
                            {userId ? (
                                <ActivePowers userId={userId} />
                            ) : (
                                <div className="text-center text-gray-500 py-3">
                                    Sign in to view active powers
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Leaderboard</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Leaderboard
                                players={allPlayers.map(player => ({
                                    id: player.id,
                                    username: player.username,
                                    clicks: player.clicks,
                                    rank: player.rank
                                }))}
                                currentUserId={user?.id || null}
                                loading={isLoading}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Connection Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ConnectionStatus status={connectionStatus} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 
