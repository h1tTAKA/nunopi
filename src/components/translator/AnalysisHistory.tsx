"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "@/lib/historyDB";
import type { Collection } from "@/lib/collections";

interface AnalysisHistoryProps {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onUpdate?: (id: string, changes: Partial<Pick<HistoryEntry, "isPinned" | "title">>) => void;
  alwaysOpen?: boolean;
  // 사용자 목록(카테고리)
  collections?: Collection[];
  activeCollectionId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onCreateCollection?: (name: string) => string;
  onDeleteCollection?: (id: string) => void;
  onToggleEntryCollection?: (entryId: string, collectionId: string) => void;
}

export default function AnalysisHistory({
  entries,
  onRestore,
  onDelete,
  onClear,
  onUpdate,
  alwaysOpen = false,
  collections = [],
  activeCollectionId = null,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  onToggleEntryCollection,
}: AnalysisHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // 목록 UI 로컬 상태
  const [barCreating, setBarCreating] = useState(false);
  const [barName, setBarName] = useState("");
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);
  const [entryNewName, setEntryNewName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const effectiveOpen = alwaysOpen || isOpen;
  const hasCollections = Boolean(onSelectCollection);

  // 열린 목록 메뉴 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (menuEntryId === null) return;
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setEntryNewName("");
        setMenuEntryId(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuEntryId]);

  if (!alwaysOpen && entries.length === 0) return null;

  const codePreview = (code: string) => {
    const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  };

  const filteredEntries = entries
    .filter((e) => !activeCollectionId || (e.collectionIds ?? []).includes(activeCollectionId))
    .filter((e) =>
      query.trim()
        ? (e.title ?? codePreview(e.code)).toLowerCase().includes(query.toLowerCase()) ||
          e.providerId.toLowerCase().includes(query.toLowerCase())
        : true,
    );

  const dateLabel = (createdAt: string): string => {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (d >= todayStart) return timeStr;
    if (d >= yesterdayStart) return `어제 ${timeStr}`;
    return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  };

  function startEditing(entry: HistoryEntry) {
    setEditingId(entry.id);
    setDraftTitle(entry.title ?? "");
  }

  function saveTitle(id: string) {
    if (editingId !== id) return;
    setEditingId(null);
    const trimmed = draftTitle.trim();
    onUpdate?.(id, { title: trimmed || undefined });
  }

  function submitBarCreate() {
    const name = barName.trim();
    if (!name) { setBarCreating(false); return; }
    const id = onCreateCollection?.(name);
    setBarName("");
    setBarCreating(false);
    if (id) onSelectCollection?.(id);
  }

  function submitEntryCreate(entryId: string) {
    const name = entryNewName.trim();
    if (!name) return;
    const id = onCreateCollection?.(name);
    setEntryNewName("");
    if (id) onToggleEntryCollection?.(entryId, id);
  }

  // 목록 필터바
  const collectionsBar = hasCollections ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelectCollection?.(null)}
        className={`rounded-lg px-2 py-0.5 text-xs font-medium transition ${
          activeCollectionId === null
            ? "bg-zinc-800 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        }`}
      >
        전체
      </button>
      {collections.map((c) => (
        <span
          key={c.id}
          className={`inline-flex items-center rounded-lg text-xs font-medium transition ${
            activeCollectionId === c.id
              ? "bg-blue-500 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          <button type="button" onClick={() => onSelectCollection?.(c.id)} className="py-0.5 pl-2 pr-1">
            📁 {c.name}
          </button>
          {onDeleteCollection && (
            <button
              type="button"
              onClick={() => { if (window.confirm(`목록 "${c.name}" 삭제? (분석 항목 자체는 안 지워짐)`)) onDeleteCollection(c.id); }}
              className="pr-1.5 opacity-60 hover:opacity-100"
              title="목록 삭제"
              aria-label={`${c.name} 목록 삭제`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {onCreateCollection && (
        barCreating ? (
          <input
            type="text"
            autoFocus
            value={barName}
            onChange={(e) => setBarName(e.target.value)}
            onBlur={submitBarCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitBarCreate(); }
              if (e.key === "Escape") { setBarName(""); setBarCreating(false); }
            }}
            placeholder="목록 이름…"
            className="w-24 rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-xs text-zinc-700 outline-none dark:border-blue-600 dark:bg-zinc-900 dark:text-zinc-200"
          />
        ) : (
          <button
            type="button"
            onClick={() => setBarCreating(true)}
            className="rounded-lg px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            + 새 목록
          </button>
        )
      )}
    </div>
  ) : null;

  const listContent = (
    <div className="space-y-1.5">
      {collectionsBar}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목 또는 provider 검색…"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-600"
      />
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
          분석 히스토리가 없다.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {activeCollectionId ? "이 목록에 담긴 분석이 없다." : "검색 결과가 없다."}
        </p>
      ) : (
        <div className={`${alwaysOpen ? "" : "max-h-48"} overflow-y-auto space-y-1.5`}>
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              ref={menuEntryId === entry.id ? menuRef : undefined}
              className={`rounded-xl border px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
                entry.isPinned
                  ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* 핀 버튼 */}
                {onUpdate && (
                  <button
                    type="button"
                    onClick={() => onUpdate(entry.id, { isPinned: !entry.isPinned })}
                    className={`shrink-0 text-sm leading-none transition ${
                      entry.isPinned
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
                    }`}
                    title={entry.isPinned ? "고정 해제" : "고정하기"}
                    aria-label={entry.isPinned ? "고정 해제" : "고정하기"}
                  >
                    {entry.isPinned ? "★" : "☆"}
                  </button>
                )}

                {/* 메인 복원 버튼 */}
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="flex-1 min-w-0 text-left"
                  aria-label={`히스토리 복원: ${entry.title ?? codePreview(entry.code)}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 shrink-0">
                      {entry.providerId}
                    </span>
                    <span className="truncate text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                      {dateLabel(entry.createdAt)}
                    </span>
                  </div>
                </button>

                {/* 목록(카테고리) 버튼 */}
                {onToggleEntryCollection && (
                  <button
                    type="button"
                    onClick={() => { setEntryNewName(""); setMenuEntryId((cur) => (cur === entry.id ? null : entry.id)); }}
                    className={`shrink-0 text-xs leading-none transition ${
                      (entry.collectionIds ?? []).length > 0
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                    }`}
                    title="목록에 추가/빼기"
                    aria-label="목록에 추가/빼기"
                  >
                    📁
                  </button>
                )}

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("이 분석 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.")) onDelete(entry.id);
                  }}
                  className="shrink-0 text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                  aria-label="분석 이력 삭제"
                >
                  ×
                </button>
              </div>

              {/* 제목 / 코드 미리보기 — 인라인 편집 */}
              <div className="mt-1.5 pl-0">
                {editingId === entry.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => saveTitle(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); saveTitle(entry.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    placeholder="제목 입력…"
                    className="w-full rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-xs text-zinc-700 outline-none dark:border-blue-600 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(entry)}
                    className="w-full text-left truncate text-xs font-mono text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    title="클릭하여 제목 편집"
                  >
                    {entry.title || codePreview(entry.code)}
                  </button>
                )}
              </div>

              {/* 목록 멤버십 인라인 패널 */}
              {menuEntryId === entry.id && onToggleEntryCollection && (
                <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">목록에 담기</p>
                    <button
                      type="button"
                      onClick={() => { setEntryNewName(""); setMenuEntryId(null); }}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                      aria-label="목록 메뉴 닫기"
                    >
                      ×
                    </button>
                  </div>
                  {collections.length === 0 && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">아직 목록이 없다.</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {collections.map((c) => {
                      const inIt = (entry.collectionIds ?? []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onToggleEntryCollection(entry.id, c.id)}
                          className={`rounded-lg px-2 py-0.5 text-xs transition ${
                            inIt
                              ? "bg-blue-500 text-white"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {inIt ? "✓ " : ""}{c.name}
                        </button>
                      );
                    })}
                  </div>
                  {onCreateCollection && (
                    <input
                      type="text"
                      value={menuEntryId === entry.id ? entryNewName : ""}
                      onChange={(e) => setEntryNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitEntryCreate(entry.id); }
                        if (e.key === "Escape") { setEntryNewName(""); setMenuEntryId(null); }
                      }}
                      placeholder="새 목록 만들어 담기 (Enter)"
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-blue-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (alwaysOpen) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            분석 이력{entries.length > 0 ? ` ${entries.length}` : ""}
          </span>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              aria-label="히스토리 전체 삭제"
            >
              모두 삭제
            </button>
          )}
        </div>
        {listContent}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setIsOpen((v) => !v); setQuery(""); }}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {effectiveOpen ? "▲" : "▼"} 히스토리 {effectiveOpen && query.trim() ? `${filteredEntries.length}/${entries.length}` : entries.length}개
        </button>
        {effectiveOpen && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="히스토리 전체 삭제"
          >
            모두 삭제
          </button>
        )}
      </div>

      {effectiveOpen && listContent}
    </div>
  );
}
