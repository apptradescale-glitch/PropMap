import React, { useEffect, useState, useCallback } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, AlertCircle, Calendar, User, ChevronDown, ChevronUp, Paperclip, Search, RefreshCw, LogOut, CheckCircle, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/FAuth';
import { db } from '@/config/firestore';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ─── Google OAuth Config ───────────────────────────────────────────
// You MUST set your own Google Client ID from Google Cloud Console:
// 1. Go to https://console.cloud.google.com/
// 2. Create a project (or select an existing one)
// 3. Enable the "Gmail API" in APIs & Services → Library
// 4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
// 5. Application type: Web application
// 6. Add your app's origin to "Authorized JavaScript origins" (e.g., http://localhost:5173)
// 7. Copy the Client ID below
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// ─── Types ─────────────────────────────────────────────────────────
interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  timestamp: number;
  snippet: string;
  body: string;
  labelIds: string[];
  hasAttachments: boolean;
}

interface GmailConnection {
  connected: boolean;
  email: string;
  connectedAt: string;
}

// Google Identity Services typings
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

export default function EmailConnectionPage() {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string>('');

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
    };
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    if (document.getElementById('google-gis-script')) {
      if (window.google?.accounts) setGisLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGisLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Load saved connection state from Firestore
  useEffect(() => {
    const loadConnection = async () => {
      if (!currentUser) return;
      try {
        const connDoc = await getDoc(doc(db, 'gmail_connections', currentUser.uid));
        if (connDoc.exists()) {
          const data = connDoc.data() as GmailConnection;
          setConnection(data);
          setConnectedEmail(data.email);
        }
      } catch (err) {
        console.error('Error loading connection:', err);
      }
    };
    loadConnection();
  }, [currentUser]);

  // Load cached emails from Firestore
  useEffect(() => {
    const loadEmails = async () => {
      if (!currentUser || !connection?.connected) return;
      setIsLoading(true);
      try {
        const emailDoc = await getDoc(doc(db, 'gmail_emails', currentUser.uid));
        if (emailDoc.exists()) {
          setEmails(emailDoc.data().emails || []);
        }
      } catch (err) {
        console.error('Error loading emails:', err);
      }
      setIsLoading(false);
    };
    loadEmails();
  }, [currentUser, connection]);

  // ─── Gmail API helpers ─────────────────────────────────────────
  const decodeBase64Url = (str: string): string => {
    try {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      return '';
    }
  };

  const getHeader = (headers: any[], name: string): string => {
    const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  const extractBody = (payload: any): string => {
    // Direct body
    if (payload.body?.data) {
      return decodeBase64Url(payload.body.data);
    }
    // Multipart — look for text/plain first, then text/html
    if (payload.parts) {
      // Check nested multipart
      for (const part of payload.parts) {
        if (part.mimeType === 'multipart/alternative' || part.mimeType === 'multipart/related') {
          const nested = extractBody(part);
          if (nested) return nested;
        }
      }
      const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        const html = decodeBase64Url(htmlPart.body.data);
        return html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    return '';
  };

  const parseFromHeader = (raw: string): { name: string; email: string } => {
    const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
    if (match) return { name: match[1].trim() || match[2], email: match[2].trim() };
    return { name: raw, email: raw };
  };

  // ─── Fetch emails from Gmail API ──────────────────────────────
  const fetchGmailEmails = useCallback(async (token: string) => {
    if (!currentUser) return;
    setIsFetching(true);
    setError(null);

    try {
      // Fetch list of message IDs (latest 50)
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (listRes.status === 401) {
        setError('Session expired. Please reconnect your Gmail.');
        setAccessToken(null);
        setIsFetching(false);
        return;
      }

      if (!listRes.ok) {
        throw new Error(`Gmail API error: ${listRes.status}`);
      }

      const listData = await listRes.json();
      const messageIds: string[] = (listData.messages || []).map((m: any) => m.id);

      if (messageIds.length === 0) {
        setEmails([]);
        setIsFetching(false);
        return;
      }

      // Fetch full message details in parallel (batches of 10)
      const fetchedEmails: GmailEmail[] = [];
      const batchSize = 10;

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (id) => {
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return null;
            return res.json();
          })
        );

        for (const msg of results) {
          if (!msg) continue;
          const headers = msg.payload?.headers || [];
          const fromRaw = getHeader(headers, 'From');
          const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw);
          const subject = getHeader(headers, 'Subject') || '(No Subject)';
          const to = getHeader(headers, 'To');
          const dateStr = getHeader(headers, 'Date');
          let timestamp: number;
          try {
            timestamp = new Date(dateStr).getTime();
            if (isNaN(timestamp)) timestamp = parseInt(msg.internalDate) || Date.now();
          } catch {
            timestamp = parseInt(msg.internalDate) || Date.now();
          }

          const body = extractBody(msg.payload || {});
          const hasAttachments = (msg.payload?.parts || []).some(
            (p: any) => p.filename && p.filename.length > 0
          );

          fetchedEmails.push({
            id: msg.id,
            threadId: msg.threadId,
            subject,
            from: fromEmail,
            fromName,
            to,
            date: dateStr,
            timestamp,
            snippet: msg.snippet || body.substring(0, 200),
            body: body.substring(0, 10000),
            labelIds: msg.labelIds || [],
            hasAttachments,
          });
        }
      }

      // Sort by date descending
      fetchedEmails.sort((a, b) => b.timestamp - a.timestamp);
      setEmails(fetchedEmails);

      // Cache in Firestore (store up to 50 emails)
      await setDoc(doc(db, 'gmail_emails', currentUser.uid), {
        emails: fetchedEmails,
        last_synced: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error fetching Gmail:', err);
      setError(err.message || 'Failed to fetch emails from Gmail.');
    }
    setIsFetching(false);
  }, [currentUser]);

  // ─── Connect Gmail via Google OAuth ───────────────────────────
  const handleConnectGmail = () => {
    if (!gisLoaded || !window.google?.accounts) {
      setError('Google sign-in is still loading. Please try again in a moment.');
      return;
    }

    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      setError('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_SCOPES,
      callback: async (response: any) => {
        if (response.error) {
          setError(`OAuth error: ${response.error}`);
          return;
        }

        const token = response.access_token;
        setAccessToken(token);

        // Get the user's Gmail address
        try {
          const profileRes = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/profile',
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const profile = await profileRes.json();
          const gmailAddress = profile.emailAddress || '';
          setConnectedEmail(gmailAddress);

          // Save connection to Firestore
          if (currentUser) {
            const connData: GmailConnection = {
              connected: true,
              email: gmailAddress,
              connectedAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'gmail_connections', currentUser.uid), connData);
            setConnection(connData);
          }

          // Fetch emails immediately
          await fetchGmailEmails(token);
        } catch (err) {
          console.error('Error getting profile:', err);
          setError('Connected but failed to fetch profile. Try refreshing.');
        }
      },
    });

    tokenClient.requestAccessToken();
  };

  // ─── Disconnect Gmail ─────────────────────────────────────────
  const handleDisconnect = async () => {
    if (accessToken && window.google?.accounts) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    setAccessToken(null);
    setConnection(null);
    setConnectedEmail('');
    setEmails([]);

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'gmail_connections', currentUser.uid));
        await deleteDoc(doc(db, 'gmail_emails', currentUser.uid));
      } catch (err) {
        console.error('Error clearing data:', err);
      }
    }
  };

  // ─── Refresh emails ───────────────────────────────────────────
  const handleRefresh = () => {
    if (accessToken) {
      fetchGmailEmails(accessToken);
    } else {
      // Need to re-authenticate (token expired)
      handleConnectGmail();
    }
  };

  // ─── Format date ──────────────────────────────────────────────
  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (days === 1) return 'Yesterday';
      if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // ─── Filter ───────────────────────────────────────────────────
  const filteredEmails = searchQuery
    ? emails.filter(e =>
        e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.snippet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails;

  const isConnected = !!connection?.connected;

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Email Connection" />

      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Email Connection</h2>
            <p className="text-sm text-[#666]">
              {isConnected
                ? `Connected to ${connectedEmail}`
                : 'Connect your Gmail to view emails'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <Button
                  variant="ghost"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="text-[#666] hover:text-white hover:bg-white/5"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  {isFetching ? 'Syncing...' : 'Refresh'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  className="text-[#666] hover:text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Not connected — connect state */}
        {!isConnected && !isLoading && (
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <Mail className="h-12 w-12 text-[#333]" />
              </div>
              <CardTitle className="text-white text-xl mb-2">
                Connect Your Gmail
              </CardTitle>
              <CardDescription className="text-[#666] max-w-md mx-auto text-center">
                Securely connect your Gmail account to view and manage your emails directly within PropMap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#666] text-xs">✓</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Read-Only Access</p>
                    <p className="text-[#666] text-xs">We only request permission to read your emails, never send or modify</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#666] text-xs">✓</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Real-Time Sync</p>
                    <p className="text-[#666] text-xs">Fetches your latest emails directly from Gmail</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#666] text-xs">✓</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Disconnect Anytime</p>
                    <p className="text-[#666] text-xs">Revoke access instantly and all cached data is removed</p>
                  </div>
                </div>
              </div>

              {/* Connect button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleConnectGmail}
                  disabled={!gisLoaded}
                  className="bg-white hover:bg-gray-100 text-black font-medium px-8 py-5 text-sm"
                >
                  {!gisLoaded ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Connect Gmail
                    </>
                  )}
                </Button>
              </div>

              {/* Security note */}
              <div className="flex items-center justify-center gap-2 text-[#555] text-xs">
                <Shield className="h-3 w-3" />
                <span>Secured with Google OAuth 2.0 — your password is never shared</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {(isLoading || isFetching) && emails.length === 0 && (
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                <span className="text-[#888] text-sm">Fetching your emails from Gmail...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected state with success indicator */}
        {isConnected && emails.length === 0 && !isLoading && !isFetching && (
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle className="h-10 w-10 text-[#6B8E7A]" />
                <p className="text-white font-medium">Gmail Connected</p>
                <p className="text-[#666] text-sm">
                  Connected to {connectedEmail}. No emails found or session expired.
                </p>
                <Button
                  onClick={handleRefresh}
                  className="mt-2 bg-white hover:bg-gray-100 text-black font-medium"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Emails
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email list */}
        {isConnected && emails.length > 0 && (
          <>
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#666] focus:border-white/40"
                />
              </div>
            </div>

            {/* Email cards */}
            <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-white">
                  {searchQuery
                    ? `${filteredEmails.length} result${filteredEmails.length !== 1 ? 's' : ''}`
                    : `${emails.length} email${emails.length !== 1 ? 's' : ''}`
                  }
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {filteredEmails.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#666] text-sm">No emails match your search</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1a1a1a]">
                    {filteredEmails.map((email) => {
                      const isExpanded = expandedEmail === email.id;
                      const isUnread = email.labelIds.includes('UNREAD');
                      return (
                        <div
                          key={email.id}
                          className="hover:bg-[#111] transition-colors"
                        >
                          {/* Email row */}
                          <div
                            className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className={`p-1.5 rounded-lg bg-transparent border shadow-lg ${
                                isUnread
                                  ? 'border-[#6B8E7A]/50 shadow-[#6B8E7A]/30'
                                  : 'border-white/10 shadow-none'
                              }`}>
                                <Mail className={`w-3.5 h-3.5 ${isUnread ? 'text-[#6B8E7A]' : 'text-[#555]'}`} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm truncate flex-1 ${isUnread ? 'text-white font-semibold' : 'text-[#ccc] font-medium'}`}>
                                  {email.subject}
                                </p>
                                <span className="text-[#555] text-xs flex-shrink-0">
                                  {formatDate(email.timestamp)}
                                </span>
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />
                                }
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className={`text-xs truncate ${isUnread ? 'text-[#999]' : 'text-[#666]'}`}>
                                  {email.fromName || email.from}
                                </span>
                                {email.hasAttachments && (
                                  <Paperclip className="w-3 h-3 text-[#555] flex-shrink-0" />
                                )}
                              </div>
                              {!isExpanded && email.snippet && (
                                <p className="text-[#555] text-xs mt-1 truncate">
                                  {email.snippet}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Expanded email body */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pl-12">
                              <div className="rounded-lg bg-[#111] border border-[#1a1a1a] p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 text-[#888]">
                                    <User className="w-3 h-3" />
                                    <span className="text-[#666]">From:</span>
                                    <span className="text-white truncate">{email.fromName} &lt;{email.from}&gt;</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[#888]">
                                    <User className="w-3 h-3" />
                                    <span className="text-[#666]">To:</span>
                                    <span className="text-white truncate">{email.to}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[#888]">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[#666]">Date:</span>
                                    <span className="text-white">
                                      {new Date(email.timestamp).toLocaleString('en-US', {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  {email.hasAttachments && (
                                    <div className="flex items-center gap-1.5 text-[#888]">
                                      <Paperclip className="w-3 h-3" />
                                      <span className="text-[#666]">Has attachments</span>
                                    </div>
                                  )}
                                </div>
                                <div className="border-t border-[#1a1a1a] pt-3">
                                  <pre className="text-[#ccc] text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                                    {email.body || '(No content)'}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
