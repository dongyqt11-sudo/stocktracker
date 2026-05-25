import { Plus, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Account, createNote, deleteNote, getNotes, NoteRow, updateNote } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

type NotesPageProps = {
  refreshKey: number;
  account: Account;
};

export default function NotesPage({ refreshKey, account }: NotesPageProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stockFilter, setStockFilter] = useState("");

  // Editor state
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));
  const [editContent, setEditContent] = useState("");
  const [editStock, setEditStock] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      setNotes(await getNotes(account.id, stockFilter || undefined));
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [account.id, stockFilter]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes, refreshKey]);

  useEffect(() => {
    setSelectedId(null);
    setEditTitle("");
    setEditDate(new Date().toISOString().slice(0, 10));
    setEditContent("");
    setEditStock("");
  }, [account.id]);

  function selectNote(note: NoteRow) {
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditDate(note.note_date);
    setEditContent(note.content);
    setEditStock(note.related_stock_code ?? "");
  }

  function startNew() {
    setSelectedId(null);
    setEditTitle("");
    setEditDate(new Date().toISOString().slice(0, 10));
    setEditContent("");
    setEditStock("");
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      if (selectedId !== null) {
        await updateNote(selectedId, account.id, {
          title: editTitle,
          note_date: editDate,
          content: editContent,
          related_stock_code: editStock || null,
        });
      } else {
        const created = await createNote(account, {
          title: editTitle || "无标题",
          note_date: editDate,
          content: editContent,
          related_stock_code: editStock || undefined,
        });
        setSelectedId(created.id);
      }
      await loadNotes();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (selectedId === null) return;
    if (!confirm("确定删除这条笔记？")) return;
    try {
      await deleteNote(selectedId, account.id);
      setSelectedId(null);
      setEditTitle("");
      setEditContent("");
      await loadNotes();
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      {/* 左侧列表 */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>笔记列表</CardTitle>
          <Button onClick={startNew} className="h-9 px-3">
            <Plus className="h-4 w-4" />
            新建
          </Button>
        </CardHeader>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-text-tertiary" />
            <Input
              type="text"
              placeholder="按股票代码筛选"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="h-[36px] rounded-lg text-sm"
              maxLength={6}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            {notes.length ? (
              notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={cn(
                    "w-full border-b border-[var(--border-light)] px-4 py-3 text-left transition hover:bg-[var(--bg-hover)]",
                    selectedId === note.id ? "border-l-[3px] border-l-primary bg-primary-light/50" : "",
                  )}
                >
                  <div className="text-xs text-text-tertiary">{note.note_date}</div>
                  <div className="mt-1 truncate text-sm font-semibold text-text-primary">{note.title || "无标题"}</div>
                  <div className="mt-1 truncate text-xs text-text-tertiary">{note.content_preview}</div>
                  {note.related_stock_code ? (
                    <span className="mt-1.5 inline-flex rounded bg-[var(--border-light)] px-1.5 py-0.5 text-[11px] font-semibold text-text-tertiary">
                      {note.related_stock_code}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-4 py-16 text-center text-sm text-text-tertiary">
                {isLoading ? "加载中..." : "暂无笔记"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 右侧编辑区 */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{selectedId ? "编辑笔记" : "新建笔记"}</CardTitle>
          <div className="flex items-center gap-2">
            {selectedId ? (
              <Button variant="outline" onClick={handleDelete} className="h-9 text-down">
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={isSaving} className="h-9">
              <Save className="h-4 w-4" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="笔记标题"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-10 flex-1 rounded-lg text-sm"
            />
            <Input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-10 w-36 rounded-lg text-sm"
            />
            <Input
              type="text"
              placeholder="关联股票(可选)"
              value={editStock}
              onChange={(e) => setEditStock(e.target.value)}
              className="h-10 w-32 rounded-lg text-sm"
              maxLength={6}
            />
          </div>
          <textarea
            placeholder="支持 Markdown 语法写笔记..."
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-[420px] w-full resize-none rounded-card border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm leading-relaxed text-text-primary outline-none transition focus:border-primary"
          />
        </CardContent>
      </Card>
    </div>
  );
}
