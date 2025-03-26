'use client';

import { useClickerGame } from "@/hooks/use-clicker-game";
import PlayerStats from "@/components/player-stats";
import Leaderboard from "@/components/leaderboard";
import ConnectionStatus from "@/components/connection-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { VolumeSlider } from "@/components/ui/volume-slider";
import { useSound } from "@/hooks/use-sound";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ActivePowers from "@/components/active-powers";
import { useSupabase } from "@/lib/supabase/provider";
import { useAchievements } from "@/hooks/use-achievements";
import { Badge } from "@/components/ui/badge";

export default function ClickerGamePage() {
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

  // Use our sound hook instead of simple volume state
  const {
    volume,
    setVolume,
    enabled: soundEnabled,
    setEnabled: setSoundEnabled,
    play
  } = useSound({ volume: 50, enabled: true });

  // Use the achievements hook to get active powers data
  const { activePowers, getClickMultiplier } = useAchievements();

  // Get user ID for the ActivePowers component
  const supabase = useSupabase();
  const [userId, setUserId] = useState<string | undefined>(undefined);

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

  // Add effect to play sound when clicking
  useEffect(() => {
    // Add event handler for the Click Me button
    const clickButton = document.querySelector('[data-click-button]');
    if (clickButton) {
      const handleClick = () => {
        if (soundEnabled) {
          play('click');
        }
      };

      clickButton.addEventListener('click', handleClick);
      return () => clickButton.removeEventListener('click', handleClick);
    }
  }, [soundEnabled, play]);

  const formattedPlayers = allPlayers.map(player => ({
    id: player.id,
    username: player.username || 'Anonymous',
    clicks: player.clicks,
    rank: player.rank
  }));

  return (
    <div className="container max-w-6xl py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clicker Game</h1>
        <p className="text-muted-foreground">
          Click as fast as you can to climb the leaderboard!
        </p>
      </div>

      <Separator />

      <div className="grid md:grid-cols-3 gap-6">
        {/* Player Stats */}
        <div className="md:col-span-1">
          <PlayerStats
            username={username}
            clickCount={clickCount}
            rank={userRank}
            loading={isLoading}
            onClickButton={async () => {
              // Play click sound first for immediate feedback
              if (soundEnabled) {
                play('click');
              }
              // Then update the server
              await handleClickUpdate();
            }}
            clickValue={clickValue}
            hasBonus={hasBonus}
            userId={userId}
          />

          {/* Active Powers Card */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>Active Powers</CardTitle>
                {activePowers.length > 0 && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                    {activePowers.length} Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {userId ? (
                <ActivePowers userId={userId} />
              ) : (
                <div className="text-center text-gray-500 py-3">
                  Sign in to view active powers
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <div className="md:col-span-2">
          <Leaderboard
            players={formattedPlayers}
            currentUserId={user?.id || null}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Game Info */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Game Rules */}
        <Card>
          <CardHeader>
            <CardTitle>How to Play</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              1. Click the button as many times as you can
            </p>
            <p>
              2. Each click adds to your total score
            </p>
            <p>
              3. Your score is saved in real-time
            </p>
            <p>
              4. Players are ranked by their total clicks
            </p>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Sound Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sound-toggle"
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
                <Label htmlFor="sound-toggle">Enable Sounds</Label>
              </div>

              <div>
                <p className="text-sm mb-2">Game Volume</p>
                <VolumeSlider
                  value={volume}
                  onValueChange={setVolume}
                  disabled={!soundEnabled}
                  className="py-2"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Current volume: {volume}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
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