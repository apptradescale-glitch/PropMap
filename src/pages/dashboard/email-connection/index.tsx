import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Upload, CheckCircle, AlertCircle, FileText, Calendar, User } from 'lucide-react';
import { useAuth } from '@/context/FAuth';
import { auth } from '@/config/firebase';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  attachments?: string[];
}

export default function EmailConnectionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Check file type
    const validTypes = ['.mbox', '.pst', '.msg'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      setError('Please upload a valid email file (.mbox, .pst, or .msg)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    try {
      // Get Firebase auth token
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('You must be logged in to upload emails.');
      }
      const authToken = await firebaseUser.getIdToken();

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('emailFile', file);

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          setEmails(result.emails || []);
          setSuccess(true);
          setUploadProgress(100);
        } else {
          const errorData = JSON.parse(xhr.responseText);
          throw new Error(errorData.error || 'Failed to upload email file');
        }
        setIsLoading(false);
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setError('Failed to upload file. Please try again.');
        setIsLoading(false);
      });

      // Send request
      xhr.open('POST', '/api/email/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.send(formData);

    } catch (err: any) {
      console.error('Error uploading emails:', err);
      setError(err.message || 'Failed to upload emails. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle drag and drop
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

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Email Connection" />
      
      <div className="max-w-2xl mx-auto pt-8">
        {/* Main Content */}
        <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Mail className="h-12 w-12 text-[#333]" />
            </div>
            <CardTitle className="text-white text-xl mb-2">
              Import Your Emails
            </CardTitle>
            <CardDescription className="text-[#666] max-w-md text-center">
              Upload your email file to view and manage your emails within PropMap
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Success State */}
            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-white text-lg font-semibold mb-2">
                  {emails.length} Emails Imported Successfully!
                </h3>
                <p className="text-[#666] mb-6">
                  Your emails have been imported and are ready to view.
                </p>
              </div>
            ) : (
              <>
                {/* Error State */}
                {error && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                )}

                {/* Upload Area */}
                <div className="space-y-4">
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive 
                        ? 'border-[#6B8E7A] bg-[#6B8E7A]/5' 
                        : 'border-[#333] hover:border-[#555]'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mbox,.pst,.msg"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    <Upload className="h-12 w-12 text-[#666] mx-auto mb-4" />
                    
                    <div className="space-y-2">
                      <p className="text-white font-medium">
                        {dragActive ? 'Drop your email file here' : 'Drag & drop your email file here'}
                      </p>
                      <p className="text-[#666] text-sm">
                        or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#6B8E7A] hover:underline"
                        >
                          browse to select
                        </button>
                      </p>
                    </div>
                    
                    <div className="mt-4 text-xs text-[#666]">
                      Supported formats: MBOX, PST, MSG
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {isLoading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#666]">Uploading and parsing...</span>
                        <span className="text-white">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                        <div
                          className="bg-[#6B8E7A] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Universal Email Support</p>
                        <p className="text-[#666] text-xs">Import from Gmail, Outlook, Apple Mail and more</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Secure Processing</p>
                        <p className="text-[#666] text-xs">Your emails are processed and stored securely</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Easy Export</p>
                        <p className="text-[#666] text-xs">Export emails from any provider as MBOX/PST files</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email List */}
            {success && emails.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-[#1a1a1a]">
                <h3 className="text-white font-medium">Imported Emails</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {emails.slice(0, 10).map((email) => (
                    <div
                      key={email.id}
                      className="p-3 rounded-lg bg-[#111] border border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-[#666] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {email.subject || '(No Subject)'}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-[#666]">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{email.from}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(email.date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {emails.length > 10 && (
                    <p className="text-center text-[#666] text-sm">
                      ...and {emails.length - 10} more emails
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
