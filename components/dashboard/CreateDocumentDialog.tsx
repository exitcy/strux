'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DOCUMENT_TEMPLATES, type DocumentTemplateId } from '@/lib/templates';
import { cn } from '@/lib/utils';

interface CreateDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (projectName: string, templateId: DocumentTemplateId) => void;
  creating?: boolean;
}

export default function CreateDocumentDialog({
  open,
  onClose,
  onCreate,
  creating,
}: CreateDocumentDialogProps) {
  const [projectName, setProjectName] = useState('General');
  const [templateId, setTemplateId] = useState<DocumentTemplateId>('design-doc');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(projectName.trim() || 'General', templateId);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            Pick a template and project. Design docs ship best to Cursor and Claude.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="template">
              Template
            </label>
            <div className="mt-2 grid gap-2">
              {DOCUMENT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left transition-colors',
                    templateId === t.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="project-name">
              Project
            </label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="General"
              className="mt-1.5"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
