'use client';

import { createClient } from '@/lib/supabase/client';
import { ReactNode, useMemo, useRef, useEffect, createContext, useContext } from 'react';

// Create a context for the Supabase client
const SupabaseContext = createContext<ReturnType<typeof createClient> | undefined>(undefined);

// Hook to use the Supabase client
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

interface SupabaseProviderProps {
  children: ReactNode;
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  // Create a memoized client to avoid unnecessary re-renders
  const supabase = useMemo(() => createClient(), []);

  // Add a ref to track initialization
  const initialized = useRef(false);

  // Ensure realtime is properly initialized
  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      initialized.current = true;

      // Make sure realtime is connected
      try {
        // Initialize a system channel for basic connectivity
        const systemChannel = supabase.channel('system');
        systemChannel.subscribe(status => {
          console.log(`System channel status: ${status}`);
        });

        // Initialize a dedicated channel for the game
        const gameChannel = supabase.channel('clicker-game');

        // Subscribe to real-time changes on the clicks table
        gameChannel
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'clicks' },
            (payload) => {
              console.log('Realtime update for clicks:', payload);
            }
          )
          // Subscribe to profile changes
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload) => {
              console.log('Realtime update for profiles:', payload);
            }
          )
          // Subscribe to user achievement changes
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'user_achievements' },
            (payload) => {
              console.log('Realtime update for user achievements:', payload);
            }
          )
          // Subscribe to user power changes
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'user_powers' },
            (payload) => {
              console.log('Realtime update for user powers:', payload);
            }
          )
          .subscribe(status => {
            console.log(`Game channel status: ${status}`);
          });

        return () => {
          supabase.removeChannel(systemChannel);
          supabase.removeChannel(gameChannel);
        };
      } catch (error) {
        console.error('Error initializing realtime:', error);
      }
    }
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}