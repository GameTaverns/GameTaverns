import { useState, useRef } from "react";
import { Upload, FileText, Trash2, ExternalLink, Shield, ChevronDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useGameDocuments,
  useUploadGameDocument,
  useDeleteGameDocument,
  useRequestCatalogSync,
  getSignedDocumentUrl,
  DOCUMENT_TYPES,
  LANGUAGES,
  type GameDocument,
} from "@/hooks/useGameDocuments";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface GameDocumentsProps {
  gameId: string;
  libraryId: string;
  catalogId?: string | null;
  canManage?: boolean;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label])
);
const LANG_LABEL: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.value, l.label])
);

const SYNC_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  not_requested: { label: "Not Submitted", variant: "outline" },
  pending: { label: "Pending Review", variant: "secondary" },
  approved: { label: "In Catalog", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function GameDocuments({ gameId, libraryId, catalogId, canManage }: GameDocumentsProps) {
  const { data: docs = [], isLoading } = useGameDocuments(gameId);
  const [uploadOpen, setUploadOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">Rulebooks & Documents</h2>
        {canManage && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <UploadForm
                gameId={gameId}
                libraryId={libraryId}
                catalogId={catalogId}
                onDone={() => setUploadOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No documents uploaded yet.</p>
          {canManage && (
            <p className="text-xs mt-1">Upload rulebooks, quick reference cards, or FAQs.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} canManage={!!canManage} catalogId={catalogId} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, canManage, catalogId }: { doc: GameDocument; canManage: boolean; catalogId?: string | null }) {
  const deleteDoc = useDeleteGameDocument();
  const requestSync = useRequestCatalogSync();
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);
  const sync = SYNC_BADGE[doc.catalog_sync_status] ?? SYNC_BADGE.not_requested;

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await getSignedDocumentUrl(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Could not open document", variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  const handleRequestSync = async () => {
    try {
      await requestSync.mutateAsync(doc.id);
      toast({ title: "Submitted for catalog review", description: "An admin will review and approve the document." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-muted/40 transition-colors">
      <FileText className="h-8 w-8 text-primary/60 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{doc.title}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{TYPE_LABEL[doc.document_type] ?? doc.document_type}</span>
          {doc.language !== "en" && (
            <span className="text-xs text-muted-foreground">· {LANG_LABEL[doc.language] ?? doc.language}</span>
          )}
          {doc.file_size_bytes && (
            <span className="text-xs text-muted-foreground">· {formatBytes(doc.file_size_bytes)}</span>
          )}
          <Badge variant={sync.variant} className="text-[10px] px-1.5 py-0 h-4">
            {sync.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen} disabled={opening}>
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        </Button>

        {canManage && catalogId && doc.catalog_sync_status === "not_requested" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Submit to global catalog"
            onClick={handleRequestSync}
            disabled={requestSync.isPending}
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}

        {canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{doc.title}" will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteDoc.mutate({ doc })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

function UploadForm({
  gameId,
  libraryId,
  catalogId,
  onDone,
}: {
  gameId: string;
  libraryId: string;
  catalogId?: string | null;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("rulebook");
  const [lang, setLang] = useState("en");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadGameDocument();
  const { toast } = useToast();

  const handleFile = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Please select a file and enter a title", variant: "destructive" });
      return;
    }
    try {
      await upload.mutateAsync({ file, gameId, libraryId, catalogId, title: title.trim(), documentType: docType, language: lang });
      toast({ title: "Document uploaded!" });
      onDone();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium">{file.name} ({formatBytes(file.size)})</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Drop PDF or image here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Max 50 MB</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rulebook v2.1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={upload.isPending || !file}>
          {upload.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload"}
        </Button>
      </div>
    </div>
  );
}
