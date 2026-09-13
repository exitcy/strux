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

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSubmit: (url: string) => void;
}

export default function LinkDialog({ open, onClose, initialUrl = '', onSubmit }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl);

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
    else setUrl(initialUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(url.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
          <DialogDescription>Enter a URL. Leave empty to remove the link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            autoFocus
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
