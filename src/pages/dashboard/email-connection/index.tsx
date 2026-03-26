import React, { useEffect, useState, useRef } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Upload, AlertCircle, FileText, Calendar, User, ChevronDown, ChevronUp, Paperclip, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/FAuth';
import { db } from '@/config/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { parseEmailFile, type ParsedEmail } from '@/lib/email-parser';

export default function EmailConnectionPage() {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load saved emails from Firestore on mount
  useEffect(() => {
    const loadEmails = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const emailDoc = await getDoc(doc(db, 'email_imports', currentUser.uid));
        if (emailDoc.exists()) {
          setEmails(emailDoc.data().emails || []);
        }
      } catch (err) {
        console.error('Error loading emails:', err);
      }
      setIsLoading(false);
    };
    loadEmails();
  }, [currentUser]);

  // Handle file upload and parse client-side
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!currentUser) {
      setError('You must be logged in to import emails.');
      return;
    }

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'mbox' && ext !== 'eml') {
      setError('Please upload a .mbox or .eml file.');
      return;
    }

    setIsParsing(true);
    setError(null);
    setParseProgress(`Reading ${file.name}...`);

    try {
      setParseProgress('Parsing emails...');
      const parsed = await parseEmailFile(file);

      if (parsed.length === 0) {
        setError('No emails found in the uploaded file. Please check the file format.');
        setIsParsing(false);
        return;
      }

      setParseProgress(`Saving ${parsed.length} emails...`);

      // Merge with existing emails, deduplicate by ID
      const existingIds = new Set(emails.map(e => e.id));
      const newEmails = parsed.filter(e => !existingIds.has(e.id));
      const merged = [...newEmails, ...emails].sort((a, b) => b.timestamp - a.timestamp);

      // Save to Firestore
      await setDoc(doc(db, 'email_imports', currentUser.uid), {
        emails: merged,
        total_emails: merged.length,
        last_updated: new Date().toISOString(),
      }, { merge: true });

      setEmails(merged);
      setParseProgress('');
    } catch (err: any) {
      console.error('Error parsing emails:', err);
      setError(err.message || 'Failed to parse emails. Please check the file format.');
    }
    setIsParsing(false);
  };

  // Clear all imported emails
  const handleClearEmails = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'email_imports', currentUser.uid), {
        emails: [],
        total_emails: 0,
        last_updated: new Date().toISOString(),
      });
      setEmails([]);
    } catch (err) {
      console.error('Error clearing emails:', err);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string, timestamp: number) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
      if (days === 1) return 'Yesterday';
      if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filter emails by search query
  const filteredEmails = searchQuery
    ? emails.filter(e =>
        e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.snippet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails;

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Email Connection" />

      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Emails</h2>
            <p className="text-sm text-[#666]">
              {emails.length > 0
                ? `${emails.length} email${emails.length !== 1 ? 's' : ''} imported`
                : 'Import your emails from any provider'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {emails.length > 0 && (
              <Button
                variant="ghost"
                onClick={handleClearEmails}
                className="text-[#666] hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="bg-white hover:bg-gray-100 text-black font-medium"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isParsing ? 'Importing...' : 'Import Emails'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mbox,.eml"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Parse progress */}
        {isParsing && parseProgress && (
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span className="text-[#888] text-sm">{parseProgress}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state — upload area */}
        {emails.length === 0 && !isLoading && !isParsing && (
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <Mail className="h-12 w-12 text-[#333]" />
              </div>
              <CardTitle className="text-white text-xl mb-2">
                Import Your Emails
              </CardTitle>
              <CardDescription className="text-[#666] max-w-md mx-auto text-center">
                Upload exported email files to view and manage them within PropMap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-[#6B8E7A] bg-[#6B8E7A]/5'
                    : 'border-[#333] hover:border-[#555]'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 text-[#666] mx-auto mb-4" />
                <p className="text-white font-medium">
                  {dragActive ? 'Drop your email file here' : 'Drag & drop your email file here'}
                </p>
                <p className="text-[#666] text-sm mt-1">
                  or click to browse
                </p>
                <div className="mt-4 text-xs text-[#555]">
                  Supported formats: MBOX, EML
                </div>
              </div>

              {/* How to export */}
              <div className="space-y-3">
                <h4 className="text-[#888] text-xs font-medium uppercase tracking-wider">How to export your emails</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#1a1a1a]">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#666] text-xs">G</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Gmail</p>
                      <p className="text-[#666] text-xs">Google Takeout → Select Gmail → Export as MBOX</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#1a1a1a]">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#666] text-xs">O</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Outlook</p>
                      <p className="text-[#666] text-xs">File → Export → Save individual emails as .eml</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#1a1a1a]">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#666] text-xs">A</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Apple Mail</p>
                      <p className="text-[#666] text-xs">Mailbox → Export Mailbox → Saves as MBOX</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
          </div>
        )}

        {/* Email list */}
        {emails.length > 0 && !isLoading && (
          <>
            {/* Search + drop zone for adding more */}
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

            {/* Compact drop zone */}
            <div
              className={`border border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-[#6B8E7A] bg-[#6B8E7A]/5'
                  : 'border-[#222] hover:border-[#444]'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-[#555] text-xs">
                <Upload className="h-3 w-3 inline mr-1 relative -top-px" />
                Drop or click to import more emails (.mbox, .eml)
              </p>
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
                              <div className="p-1.5 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[#6B8E7A]/30">
                                <Mail className="w-3.5 h-3.5 text-[#6B8E7A]" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white text-sm font-medium truncate flex-1">
                                  {email.subject}
                                </p>
                                <span className="text-[#555] text-xs flex-shrink-0">
                                  {formatDate(email.date, email.timestamp)}
                                </span>
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />
                                }
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[#888] text-xs truncate">
                                  {email.fromName || email.from}
                                </span>
                                {email.provider !== 'Other' && (
                                  <span className="text-[#555] text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex-shrink-0">
                                    {email.provider}
                                  </span>
                                )}
                                {email.attachments.length > 0 && (
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
                                  {email.attachments.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-[#888]">
                                      <Paperclip className="w-3 h-3" />
                                      <span className="text-[#666]">Attachments:</span>
                                      <span className="text-white">{email.attachments.join(', ')}</span>
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
