import { useState, useRef } from "react";
import { Upload, FileText, Trash2, ExternalLink, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useCatalogDocuments, useUploadCatalogDocument, useDeleteCatalogDocument,
  getSignedCatalogDocumentUrl, type CatalogDocument,
} from "@/hooks/useCatalogDocuments";
import { DOCUMENT_TYPES, LANGUAGES } from "@/hooks/useGameDocuments";

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

interface CatalogDocumentsProps {
  catalogId: string;
  canManage?: boolean;
}

export function CatalogDocuments({ catalogId, canManage }: CatalogDocumentsProps) {
  const { data: docs = [], isLoading } = useCatalogDocuments(catalogId);
  const [uploadOpen, setUploadOpen] = useState(false);

  if (isLoading) {
    return <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">Catalog Documents</h3>
        {canManage && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Catalog Document</DialogTitle></DialogHeader>
              <CatalogUploadForm catalogId={catalogId} onDone={() => setUploadOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No catalog-level documents yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <CatalogDocRow key={doc.id} doc={doc} canManage={!!canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only list for library game pages (auto-inherited) */
export function InheritedCatalogDocuments({ catalogId }: { catalogId: string }) {
  const { data: docs = [], isLoading } = useCatalogDocuments(catalogId);

  if (isLoading || docs.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Community Documents</p>
      {docs.map((doc) => (
        <CatalogDocRow key={doc.id} doc={doc} canManage={false} />
      ))}
    </div>
  );
}

function CatalogDocRow({ doc, canManage }: { doc: CatalogDocument; canManage: boolean }) {
  const deleteDoc = useDeleteCatalogDocument();
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await getSignedCatalogDocumentUrl(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Could not open document", variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-muted/40 transition-colors">
      <FileText className="h-8 w-8 text-primary/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{doc.title}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{TYPE_LABEL[doc.document_type] ?? doc.document_type}</span>
          {doc.language !== "en" && <span className="text-xs text-muted-foreground">· {LANG_LABEL[doc.language] ?? doc.language}</span>}
          {doc.file_size_bytes && <span className="text-xs text-muted-foreground">· {formatBytes(doc.file_size_bytes)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen} disabled={opening}>
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        </Button>
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
                <AlertDialogDescription>"{doc.title}" will be permanently removed from the catalog.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteDoc.mutate({ doc })}
                >Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

function CatalogUploadForm({ catalogId, onDone }: { catalogId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("rulebook");
  const [lang, setLang] = useState("en");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCatalogDocument();
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
      await upload.mutateAsync({ file, catalogId, title: title.trim(), documentType: docType, language: lang });
      toast({ title: "Document uploaded to catalog!" });
      onDone();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {file ? <p className="text-sm font-medium">{file.name} ({formatBytes(file.size)})</p> : (
          <><p className="text-sm text-muted-foreground">Drop PDF or image here, or click to browse</p><p className="text-xs text-muted-foreground mt-1">Max 50 MB</p></>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-doc-title">Title</Label>
        <Input id="cat-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rulebook v2.1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
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
