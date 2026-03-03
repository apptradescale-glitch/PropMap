import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import TradovateLogo from '@/assets/images/tradovate.png';
import UnknownLogo from '@/assets/images/unknown.png';
import PJXLogo from '@/assets/images/topstepX.jpg';
import VolumetricaLogo from '@/assets/images/volumetrica.png';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/context/FAuth';

export function ConnectFuturesPopup({ open, onOpenChange, onAccountsConnected }: { open: boolean, onOpenChange: (v: boolean) => void, onAccountsConnected?: () => void }) {
  const { currentUser } = useAuth();
  const [connectMode, setConnectMode] = useState<'tradovate' | 'projectx' | 'volumetrica'>('tradovate');
  const [topstepUserName, setTopstepUserName] = useState('');
  const [topstepApiKey, setTopstepApiKey] = useState('');
  const [volLogin, setVolLogin] = useState('');
  const [volPassword, setVolPassword] = useState('');
  const [volEnvironment] = useState<0 | 1>(0);
  const [showVolumetricaBetaDialog, setShowVolumetricaBetaDialog] = useState(false);
  const [volumetricaBetaUnlocked, setVolumetricaBetaUnlocked] = useState(false);
  const [volumetricaBetaPassword, setVolumetricaBetaPassword] = useState('');
  const [volumetricaBetaPasswordInput, setVolumetricaBetaPasswordInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectTradovate = async () => {
    try {
      setIsConnecting(true);
      if (!currentUser?.uid) {
        alert('You must be logged in to connect accounts.');
        setIsConnecting(false);
        return;
      }

      const token = await currentUser.getIdToken();
      const resp = await fetch('/api/tradovate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'oauth/start', userId: currentUser.uid }),
      });

      const data = await resp.json();
      if (!resp.ok || !data?.authUrl || !data?.state) {
        alert(`Failed to start Tradovate OAuth (${resp.status}).`);
        setIsConnecting(false);
        return;
      }

      // Store state for callback exchange validation.
      localStorage.setItem('tradovate_oauth_state', String(data.state));
      window.location.href = String(data.authUrl);
    } catch (e: any) {
      alert(`Failed to start Tradovate OAuth: ${e?.message || 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const handleUnlockVolumetricaBeta = async () => {
    try {
      if (!currentUser?.uid) {
        alert('You must be logged in to continue.');
        return;
      }
      const userToken = await currentUser.getIdToken();
      if (!volumetricaBetaPasswordInput) {
        alert('Please enter the dev password.');
        return;
      }

      const resp = await fetch('/api/volumetrica', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          action: 'beta-check',
          userId: currentUser.uid,
          betaPassword: volumetricaBetaPasswordInput,
        }),
      });

      if (!resp.ok) {
        alert('Incorrect dev password.');
        return;
      }

      setVolumetricaBetaUnlocked(true);
      setVolumetricaBetaPassword(volumetricaBetaPasswordInput);
      setShowVolumetricaBetaDialog(false);
    } catch (e: any) {
      alert(`Unable to validate dev password: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleConnectVolumetrica = async () => {
    setIsConnecting(true);
    try {
      if (!currentUser?.uid) {
        alert('You must be logged in to connect accounts.');
        setIsConnecting(false);
        return;
      }
      const userToken = await currentUser.getIdToken();
      if (!volLogin || !volPassword) {
        alert('Please enter your Volumetrica login and password.');
        setIsConnecting(false);
        return;
      }

      const authResp = await fetch('/api/volumetrica', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          action: 'authenticate',
          userId: currentUser.uid,
          login: volLogin,
          password: volPassword,
          environment: volEnvironment,
          betaPassword: volumetricaBetaPassword,
        }),
      });

      if (!authResp.ok) {
        const txt = await authResp.text();
        alert(`Volumetrica authentication failed (${authResp.status}): ${txt}`);
        setIsConnecting(false);
        return;
      }

      const connectResp = await fetch('/api/volumetrica', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ action: 'connect', userId: currentUser.uid, betaPassword: volumetricaBetaPassword }),
      });

      if (!connectResp.ok) {
        const txt = await connectResp.text();
        alert(`Failed to fetch Volumetrica accounts (${connectResp.status}): ${txt}`);
        setIsConnecting(false);
        return;
      }

      await connectResp.json().catch(() => null);
      setIsConnecting(false);
      onOpenChange(false);
      if (onAccountsConnected) {
        onAccountsConnected();
      }
    } catch (e: any) {
      alert(`Error starting Volumetrica connection: ${e?.message || 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const handleConnectProjectX = async () => {
    setIsConnecting(true);
    try {
      if (!currentUser?.uid) {
        alert('You must be logged in to connect accounts.');
        setIsConnecting(false);
        return;
      }
      const userToken = await currentUser.getIdToken();
      if (!topstepUserName || !topstepApiKey) {
        alert('Please enter TopstepX Username and API Key.');
        setIsConnecting(false);
        return;
      }
  
      const authResp = await fetch('/api/projectx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ action: 'authenticate', provider: 'TopstepX', userId: currentUser.uid, userName: topstepUserName, apiKey: topstepApiKey }),
      });
      if (!authResp.ok) {
        const txt = await authResp.text();
      
        alert(`TopstepX authentication failed (${authResp.status}): ${txt}`);
        setIsConnecting(false);
        return;
      }
    
      // 2) Validate session (optional but useful)
      const validateResp = await fetch('/api/projectx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ action: 'validateSession', provider: 'TopstepX', userId: currentUser.uid }),
      });
      if (!validateResp.ok) {
        const txt = await validateResp.text();
      
      } else {
       
      }
      // 3) Connect accounts (fetch and persist)
      const connectResp = await fetch('/api/projectx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ action: 'connect', provider: 'TopstepX', userId: currentUser.uid }),
      });
      if (!connectResp.ok) {
        const txt = await connectResp.text();
      
        alert(`Failed to fetch TopstepX accounts (${connectResp.status}): ${txt}`);
        setIsConnecting(false);
        return;
      }
      const data = await connectResp.json();
    
      setIsConnecting(false);
      onOpenChange(false);
      // Trigger refresh in parent component
      if (onAccountsConnected) {
        onAccountsConnected();
      }
    } catch (e: any) {
   
      alert(`Error starting TopstepX connection: ${e?.message || 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="text-lg">Connect your Accounts to Tradescale</span>
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div className="flex items-center justify-center gap-3 mb-4 mt-2">
          <button
            className={`px-4 py-2 text-sm rounded-lg border transition-all ${
              connectMode === 'tradovate' 
                ? 'text-white border-[#94bba3] shadow-[0_0_15px_rgba(148,187,163,0.6)]' 
                : 'text-white border-white/20 hover:bg-[#94bba3]/20'
            } bg-transparent`}
            onClick={() => setConnectMode('tradovate')}
          >
            Tradovate / NinjaTrader
          </button>
          <button
            className={`px-4 py-2 text-sm rounded-lg border transition-all ${
              connectMode === 'projectx' 
                ? 'text-white border-[#94bba3] shadow-[0_0_15px_rgba(148,187,163,0.6)]' 
                : 'text-white border-white/20 hover:bg-[#94bba3]/20'
            } bg-transparent`}
            onClick={() => setConnectMode('projectx')}
          >
            TopstepX
          </button>
          <button
            className={`px-4 py-2 text-sm rounded-lg border transition-all ${
              connectMode === 'volumetrica'
                ? 'text-white border-[#94bba3] shadow-[0_0_15px_rgba(148,187,163,0.6)]'
                : 'text-white border-white/20 hover:bg-[#94bba3]/20'
            } bg-transparent`}
            onClick={() => {
              setConnectMode('volumetrica');
              if (!volumetricaBetaUnlocked) {
                setShowVolumetricaBetaDialog(true);
              }
            }}
          >
            Volumetrica Beta
          </button>
        </div>
        <Dialog open={showVolumetricaBetaDialog} onOpenChange={() => {}}>
          <DialogContent className="no-x-close">
            <DialogHeader>
              <DialogTitle>
                <span className="text-lg">Volumetrica Beta</span>
              </DialogTitle>
            </DialogHeader>
            <div className="text-base text-muted-foreground">
              Volumetrica is currently in testing and not yet done, we will inform you if its ready to use.
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <label className="text-sm text-white ml-1">Dev Password</label>
              <input
                type="password"
                className="bg-transparent border border-white/15 text-white px-3 py-2 rounded-md focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none"
                placeholder=""
                value={volumetricaBetaPasswordInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVolumetricaBetaPasswordInput(e.target.value)}
              />
            </div>
            <div className="flex justify-center mt-4">
              <button
                className="h-9 w-auto px-4 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleUnlockVolumetricaBeta}
                disabled={isConnecting}
              >
                Continue
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {connectMode === 'tradovate' ? (
          <>
            <div className="flex items-center gap-2 mb-2 mt-2">
              <img src={TradovateLogo} alt="Tradovate" className="w-12 h-12" />
              <span className="text-base font-semibold text-white">Connection your Tradovate / NinjaTrader Prop Account</span>
            </div>
            <div className="text-base text-muted-foreground mb-2">
              Tradovate & Ninjatrader Accounts are both being connected via the Tradovate Infrastructure. Only Prop firm demo accounts are supported.
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-center">
                <button
                  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleConnectTradovate}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '+ Add Account here'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : connectMode === 'projectx' ? (
          <>
            <div className="flex items-center gap-2 mb-2 mt-2">
              <img src={PJXLogo} alt="TopstepX" className="w-18 h-8" />
              <span className="text-base font-semibold text-white">Connecting your TopstepX Account</span>
            </div>
            <div className="text-base text-muted-foreground mb-2">
              TopstepX Accounts are being connected via the ProjectX Infrastructure.
            </div>
            <div className="flex flex-col gap-4 mb-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white ml-1">TopstepX Username</label>
                <input
                  className="bg-transparent border border-white/15 text-white px-3 py-2 rounded-md focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none"
                  placeholder=""
                  value={topstepUserName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopstepUserName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white ml-1">TopstepX API Key</label>
                <input
                  className="bg-transparent border border-white/15 text-white px-3 py-2 rounded-md focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none"
                  placeholder=""
                  value={topstepApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopstepApiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-center">
                <button
                  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleConnectProjectX}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '+ Add Account'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : connectMode === 'volumetrica' && volumetricaBetaUnlocked ? (
          <>
            <div className="flex items-center gap-2 mb-2 mt-2">
              <img src={VolumetricaLogo} alt="Volumetrica" className="w-18 h-8" />
              <span className="text-base font-semibold text-white">Connecting your Volumetrica Account</span>
            </div>
         
            <div className="text-base text-muted-foreground mb-2">
              Volumetrica (Deepcharts, VolSys & more) accounts are connected via Volumetrica API credentials.
            </div>
            <div className="flex flex-col gap-4 mb-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white ml-1">Login</label>
                <input
                  className="bg-transparent border border-white/15 text-white px-3 py-2 rounded-md focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none"
                  placeholder=""
                  value={volLogin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVolLogin(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white ml-1">Password</label>
                <input
                  type="password"
                  className="bg-transparent border border-white/15 text-white px-3 py-2 rounded-md focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 focus:outline-none"
                  placeholder=""
                  value={volPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVolPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-center">
                <button
                  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleConnectVolumetrica}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '+ Add Account'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}