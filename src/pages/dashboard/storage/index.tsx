import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '@/config/firestore';
import { storage } from '@/config/firebase';
import { useAuth } from '@/context/FAuth';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive,
  Plus,
  FileText,
  FileImage,
  File,
  Download,
  Trash2,
  Eye,
  Search,
  Filter,
  Calendar,
  Tag,
  X,
  Upload,
  MoreHorizontal
} from 'lucide-react';

interface StorageItem {
  id: string;
  fileName: string;
  label: string;
  description: string;
  category: string;
  documentDate: string;
  uploadedAt: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

const CATEGORIES = [
  'Invoice',
  'Certificate',
  'Contract',
  'Receipt',
  'Tax Document',
  'License',
  'Report',
  'Other'
];

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType === 'application/pdf' || fileType.includes('document') || fileType.includes('text')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function StoragePage() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadDocDate, setUploadDocDate] = useState('');

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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

  // Load stored documents from Firestore
  useEffect(() => {
    const loadItems = async () => {
      if (!currentUser) return;
      try {
        const storageDoc = await getDoc(doc(db, 'storage', currentUser.uid));
        if (storageDoc.exists()) {
          setItems(storageDoc.data().items || []);
        }
      } catch (error) {
        console.error('Error loading storage items:', error);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [currentUser]);

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadLabel('');
    setUploadDescription('');
    setUploadCategory('');
    setUploadDocDate('');
  };

  const handleUpload = async () => {
    if (!currentUser || !uploadFile || !uploadLabel) return;
    setUploading(true);
    try {
      const fileId = crypto.randomUUID();
      const storagePath = `storage/${currentUser.uid}/${fileId}_${uploadFile.name}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, uploadFile);
      const fileUrl = await getDownloadURL(fileRef);

      const newItem: StorageItem = {
        id: fileId,
        fileName: uploadFile.name,
        label: uploadLabel,
        description: uploadDescription,
        category: uploadCategory || 'Other',
        documentDate: uploadDocDate || new Date().toISOString().split('T')[0],
        uploadedAt: new Date().toISOString(),
        fileUrl,
        fileType: uploadFile.type,
        fileSize: uploadFile.size,
        storagePath
      };

      const updatedItems = [newItem, ...items];
      await setDoc(doc(db, 'storage', currentUser.uid), { items: updatedItems }, { merge: true });
      setItems(updatedItems);
      resetUploadForm();
      setIsUploadOpen(false);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!currentUser) return;
    try {
      const item = items.find(i => i.id === itemId);
      if (item?.storagePath) {
        try {
          const fileRef = ref(storage, item.storagePath);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn('File may already be deleted from storage:', e);
        }
      }
      const updatedItems = items.filter(i => i.id !== itemId);
      await setDoc(doc(db, 'storage', currentUser.uid), { items: updatedItems }, { merge: true });
      setItems(updatedItems);
      setDeleteConfirm(null);
      setActiveMenu(null);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Storage" />
      <div className="space-y-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-6 w-6 text-[#e0ac69]" />
            <div>
              <h2 className="text-xl font-semibold text-white">Storage</h2>
              <p className="text-sm text-[#666]">Store and manage your documents, invoices & certificates</p>
            </div>
          </div>
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-[#e0ac69] hover:bg-[#c99a5a] text-black font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#666] focus:border-[#e0ac69]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#666]" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[160px] bg-[#111] border-[#2a2a2a] text-white">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#2a2a2a]">
                    <SelectItem value="all" className="text-white hover:bg-white/5">All Categories</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-white hover:bg-white/5">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#666]">Total Documents</p>
                  <p className="text-2xl font-bold text-white">{items.length}</p>
                </div>
                <FileText className="h-8 w-8 text-[#e0ac69] opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#666]">Invoices</p>
                  <p className="text-2xl font-bold text-white">{items.filter(i => i.category === 'Invoice').length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#666]">Certificates</p>
                  <p className="text-2xl font-bold text-white">{items.filter(i => i.category === 'Certificate').length}</p>
                </div>
                <FileText className="h-8 w-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#666]">Total Size</p>
                  <p className="text-2xl font-bold text-white">{formatFileSize(items.reduce((s, i) => s + i.fileSize, 0))}</p>
                </div>
                <Archive className="h-8 w-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Documents</CardTitle>
            <CardDescription className="text-[#666]">
             
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e0ac69]" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Archive className="h-12 w-12 text-[#333] mb-4" />
                <p className="text-[#666] text-sm">
                  {items.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
                </p>
                {items.length === 0 && (
                  <Button
                    onClick={() => setIsUploadOpen(true)}
                    variant="outline"
                    className="mt-4 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload your first document
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const IconComponent = getFileIcon(item.fileType);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-[#2a2a2a] hover:border-[#444] transition-colors group"
                    >
                      {/* File Icon */}
                      <div className="flex-shrink-0 p-2.5 rounded-lg bg-[#111] border border-[#2a2a2a]">
                        <IconComponent className="h-5 w-5 text-[#e0ac69]" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{item.label}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] flex-shrink-0">{item.category}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#666] truncate mt-0.5">{item.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-[#555] flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(item.documentDate).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-[#555]">{formatFileSize(item.fileSize)}</span>
                          <span className="text-[10px] text-[#555] truncate">{item.fileName}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                          className="p-2 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {activeMenu === item.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-[#2a2a2a] bg-[#111] shadow-xl py-1">
                            <button
                              onClick={() => { setPreviewItem(item); setActiveMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white hover:bg-white/5"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Details
                            </button>
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setActiveMenu(null)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white hover:bg-white/5"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                            <button
                              onClick={() => { setDeleteConfirm(item.id); setActiveMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-white/5"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { setIsUploadOpen(open); if (!open) resetUploadForm(); }}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#e0ac69]" />
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* File Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                uploadFile ? 'border-[#e0ac69]/50 bg-[#e0ac69]/5' : 'border-[#2a2a2a] hover:border-[#444]'
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    if (!uploadLabel) setUploadLabel(file.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-[#e0ac69]" />
                  <div className="text-left">
                    <p className="text-sm text-white font-medium truncate max-w-[250px]">{uploadFile.name}</p>
                    <p className="text-xs text-[#666]">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="p-1 hover:bg-white/10 rounded">
                    <X className="h-4 w-4 text-[#666]" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-[#444] mx-auto mb-2" />
                  <p className="text-sm text-[#666]">Click to select a file</p>
                  <p className="text-xs text-[#555] mt-1">PDF, images, documents up to 25MB</p>
                </>
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label className="text-[#999] text-xs">Label *</Label>
              <Input
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="e.g. January Invoice"
                className="bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#555] focus:border-[#e0ac69]"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[#999] text-xs">Description</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Optional description..."
                className="bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#555] focus:border-[#e0ac69]"
              />
            </div>

            {/* Category & Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[#999] text-xs flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Category
                </Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-[#111] border-[#2a2a2a] text-white">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#2a2a2a]">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-white hover:bg-white/5">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#999] text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Document Date
                </Label>
                <Input
                  type="date"
                  value={uploadDocDate}
                  onChange={(e) => setUploadDocDate(e.target.value)}
                  className="bg-[#111] border-[#2a2a2a] text-white focus:border-[#e0ac69]"
                />
              </div>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadLabel || uploading}
              className="w-full bg-[#e0ac69] hover:bg-[#c99a5a] text-black font-medium disabled:opacity-50"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                  Uploading...
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview/Details Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => { if (!open) setPreviewItem(null); }}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#e0ac69]" />
              Document Details
            </DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4 mt-2">
              {/* Preview area */}
              {previewItem.fileType.startsWith('image/') ? (
                <div className="rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#111]">
                  <img src={previewItem.fileUrl} alt={previewItem.label} className="w-full max-h-[300px] object-contain" />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-[#2a2a2a] bg-[#111]">
                  <FileText className="h-10 w-10 text-[#e0ac69]" />
                  <div>
                    <p className="text-sm font-medium text-white">{previewItem.fileName}</p>
                    <p className="text-xs text-[#666]">{formatFileSize(previewItem.fileSize)} · {previewItem.fileType}</p>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
                  <span className="text-xs text-[#666]">Label</span>
                  <span className="text-sm text-white">{previewItem.label}</span>
                </div>
                {previewItem.description && (
                  <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
                    <span className="text-xs text-[#666]">Description</span>
                    <span className="text-sm text-white text-right max-w-[250px]">{previewItem.description}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
                  <span className="text-xs text-[#666]">Category</span>
                  <span className="text-sm text-white">{previewItem.category}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
                  <span className="text-xs text-[#666]">Document Date</span>
                  <span className="text-sm text-white">{new Date(previewItem.documentDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
                  <span className="text-xs text-[#666]">Uploaded</span>
                  <span className="text-sm text-white">{new Date(previewItem.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={previewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-white">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </a>
                <Button
                  variant="outline"
                  onClick={() => { setDeleteConfirm(previewItem.id); setPreviewItem(null); }}
                  className="bg-transparent border-[#2a2a2a] hover:bg-red-500/10 hover:border-red-500/30 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#999]">Are you sure you want to delete this document? This action cannot be undone.</p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
