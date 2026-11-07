// The student's imported notes, shared by the chat and quiz pages.
import { useCallback, useState } from "react";
import type { StudyDocument } from "../../../shared/types";
import { api } from "../api";

export function useDocuments() {
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api.listDocuments().then(setDocuments, (e: Error) => setError(e.message));
  }, []);

  async function upload(files: File[]): Promise<StudyDocument[]> {
    setUploading(true);
    setError("");
    const added: StudyDocument[] = [];
    try {
      for (const file of files) {
        const document = await api.uploadDocument(file);
        added.push(document);
        setDocuments((current) => [...current, document]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that file.");
    } finally {
      setUploading(false);
    }
    return added;
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.deleteDocument(id);
      setDocuments((current) => current.filter((document) => document.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove those notes.");
    }
  }

  return { documents, uploading, error, upload, remove, reload };
}

export type Documents = ReturnType<typeof useDocuments>;

export const ACCEPTED_FILES = ".txt,.md,.pdf,.pptx,.png,.jpg,.jpeg,.webp";
