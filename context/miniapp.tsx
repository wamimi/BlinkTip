'use client'

import { sdk } from '@farcaster/miniapp-sdk';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAccount } from 'wagmi';

interface MiniAppUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
}

interface MiniAppContextType {
  isInMiniApp: boolean;
  isReady: boolean;
  user: MiniAppUser | null;
  walletAddress: string | null;
  walletSource: 'base-account' | 'reown' | null;
}

const MiniAppContext = createContext<MiniAppContextType | undefined>(undefined);

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<MiniAppUser | null>(null);

  // Wagmi hook for Base Account (when in mini app)
  const { address: baseAccountAddress } = useAccount();

  useEffect(() => {
    async function initialize() {
      try {
        // Check if running in mini app
        const miniAppStatus = await sdk.isInMiniApp();
        setIsInMiniApp(miniAppStatus);

        if (miniAppStatus) {
          // Get Farcaster user context
          const context = await sdk.context;
          setUser(context.user);

          // Signal app is ready (shows your app, hides splash screen)
          await sdk.actions.ready();
          console.log('✅ Mini App initialized:', context.user);
        } else {
          console.log('ℹ️ Not in mini app - using web mode');
        }

        setIsReady(true);
      } catch (error) {
        console.error('Mini app initialization error:', error);
        // Still set ready even on error - fallback to web mode
        setIsReady(true);
      }
    }

    initialize();
  }, []);

  // Determine wallet source and address
  const walletAddress = isInMiniApp ? (baseAccountAddress || null) : null;
  const walletSource = isInMiniApp ? 'base-account' : 'reown';

  return (
    <MiniAppContext.Provider value={{
      isInMiniApp,
      isReady,
      user,
      walletAddress,
      walletSource
    }}>
      {children}
    </MiniAppContext.Provider>
  );
}

export function useMiniApp() {
  const context = useContext(MiniAppContext);
  if (!context) {
    throw new Error('useMiniApp must be used within MiniAppProvider');
  }
  return context;
}
