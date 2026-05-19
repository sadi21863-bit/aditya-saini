"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Wand2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

type LTMatch = {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { issueType: string; description: string };
};

type IssueType = "spelling" | "grammar" | "style" | "punctuation" | "other";

const ISSUE_STYLES: Record<IssueType, { underline: string; badge: string; dot: string }> = {
  spelling:    { underline: "underline decoration-red-400 decoration-2 decoration-wavy",    badge: "bg-red-50 border-red-200 text-red-700",      dot: "bg-red-400" },
  grammar:     { underline: "underline decoration-amber-400 decoration-2 decoration-wavy",  badge: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-400" },
  style:       { underline: "underline decoration-blue-400 decoration-2 decoration-wavy",   badge: "bg-blue-50 border-blue-200 text-blue-700",    dot: "bg-blue-400" },
  punctuation: { underline: "underline decoration-purple-400 decoration-2 decoration-wavy", badge: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-400" },
  other:       { underline: "underline decoration-ic-muted decoration-2 decoration-wavy",   badge: "bg-ic-paper-deep border-ic-rule text-ic-muted", dot: "bg-ic-muted" },
};

function classify(m: LTMatch): IssueType {
  const t = (m.rule.issueType || "").toLowerCase();
  const d = (m.rule.description || "").toLowerCase();
  if (t.includes("misspelling") || d.includes("spelling")) return "spelling";
  if (t.includes("grammar") || d.includes("grammar")) return "grammar";
  if (t.includes("style")) return "style";
  if (d.includes("punctuation")) return "punctuation";
  return "other";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface Props {
  name: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}

export default function IdeaTextEditor({
  name,
  value,
  onChange,
  placeholder = "Write your idea here...",
  rows = 7,
  required = false,
  maxLength,
}: Props) {
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHtml = useCallback(
    (text: string, currentMatches: LTMatch[]) => {
      const sorted = [...currentMatches].sort((a, b) => a.offset - b.offset);
      let html = "";
      let cursor = 0;
      sorted.forEach((m, i) => {
        if (m.offset < cursor) return;
        html += escapeHtml(text.slice(cursor, m.offset));
        const style = ISSUE_STYLES[classify(m)];
        html += `<mark data-idx="${i}" class="rounded-sm cursor-pointer bg-transparent ${style.underline}">${escapeHtml(
          text.slice(m.offset, m.offset + m.length)
        )}</mark>`;
        cursor = m.offset + m.length;
      });
      html += escapeHtml(text.slice(cursor));
      return html || "";
    },
    []
  );

  useEffect(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    let caretOffset = 0;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(editorRef.current);
      preRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preRange.toString().length;
    }
    editorRef.current.innerHTML = buildHtml(value, matches);
    restoreCaret(editorRef.current, caretOffset);
  }, [matches, buildHtml, value]);

  function restoreCaret(el: HTMLElement, offset: number) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (remaining <= node.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
      remaining -= node.length;
    }
  }

  const handleInput = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText;
    onChange(text);
    setMatches([]);
    setActiveIdx(null);
    setPanelOpen(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) {
        const currentText = editorRef.current.innerText;
        if (currentText.trim().length > 20) {
          handleCheckDebounced(currentText);
        }
      }
    }, 500);
  };

  const handleCheckDebounced = async (text: string) => {
    setIsChecking(true);
    setActiveIdx(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: "en-US" }),
      });
      const data = await res.json();
      const newMatches: LTMatch[] = data.matches || [];
      setMatches(newMatches);
      setPanelOpen(newMatches.length > 0);
    } catch {
      setMatches([]);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheck = async () => {
    if (!value.trim()) return;
    setIsChecking(true);
    setActiveIdx(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, language: "en-US" }),
      });
      const data = await res.json();
      const newMatches: LTMatch[] = data.matches || [];
      setMatches(newMatches);
      setPanelOpen(newMatches.length > 0);
    } catch {
      setMatches([]);
    } finally {
      setIsChecking(false);
    }
  };

  const applySuggestion = (idx: number, replacement: string) => {
    const m = matches[idx];
    const before = value.slice(0, m.offset);
    const after = value.slice(m.offset + m.length);
    const updated = before + replacement + after;
    const diff = replacement.length - m.length;
    const newMatches = matches
      .map((match, i) => {
        if (i === idx) return null;
        if (match.offset > m.offset) return { ...match, offset: match.offset + diff };
        return match;
      })
      .filter(Boolean) as LTMatch[];
    onChange(updated);
    setMatches(newMatches);
    setActiveIdx(null);
    if (editorRef.current) editorRef.current.innerText = updated;
  };

  const dismissMatch = (idx: number) => {
    setMatches((prev) => prev.filter((_, i) => i !== idx));
    if (activeIdx === idx) setActiveIdx(null);
  };

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  const groups: Record<IssueType, { match: LTMatch; idx: number }[]> = {
    spelling: [], grammar: [], style: [], punctuation: [], other: [],
  };
  matches.forEach((m, i) => groups[classify(m)].push({ match: m, idx: i }));

  const issueLabels: Record<IssueType, string> = {
    spelling: "Spelling", grammar: "Grammar", style: "Style",
    punctuation: "Punctuation", other: "Other",
  };

  return (
    <div className="flex flex-col gap-0">
      <input type="hidden" name={name} value={value} />
      {required && <input type="text" required className="sr-only" value={value} onChange={() => {}} tabIndex={-1} />}

      {/* Editor container */}
      <div className="relative rounded-2xl border border-ic-rule bg-ic-paper focus-within:border-ic-accent transition-all overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-ic-rule bg-ic-card">
          <div className="flex items-center gap-3 font-mono text-[11px] text-ic-muted">
            <span>{wordCount} words</span>
            <span className="text-ic-rule">|</span>
            <span>{charCount}{maxLength ? `/${maxLength}` : ""} chars</span>
            {matches.length > 0 && (
              <>
                <span className="text-ic-rule">|</span>
                <span className="text-amber-500 font-semibold">
                  {matches.length} issue{matches.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleCheck}
            disabled={isChecking || !value.trim()}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1 rounded-xl
              bg-ic-accent/10 text-ic-accent hover:bg-ic-accent/20
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isChecking ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Wand2 size={11} />
            )}
            {isChecking ? "Checking…" : "Check writing"}
          </button>
        </div>

        {/* Contenteditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={placeholder}
          onInput={handleInput}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            const idx = t.getAttribute("data-idx");
            if (idx !== null) {
              setActiveIdx(parseInt(idx));
              setPanelOpen(true);
            }
          }}
          style={{ minHeight: `${rows * 1.75}rem` }}
          className="w-full px-4 py-3 text-sm leading-relaxed text-ic-ink outline-none
            whitespace-pre-wrap break-words font-sans
            empty:before:content-[attr(data-placeholder)]
            empty:before:text-ic-muted empty:before:pointer-events-none"
        />

        {/* Status bar */}
        {matches.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-ic-rule bg-ic-card">
            <div className="flex items-center gap-2">
              {(["spelling", "grammar", "style", "punctuation"] as IssueType[]).map((type) => {
                const count = groups[type].length;
                if (!count) return null;
                return (
                  <span key={type} className="flex items-center gap-1 font-mono text-[10px] text-ic-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${ISSUE_STYLES[type].dot}`} />
                    {count} {issueLabels[type]}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="flex items-center gap-1 font-mono text-[11px] text-ic-accent hover:underline"
            >
              {panelOpen ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Show suggestions</>}
            </button>
          </div>
        )}
      </div>

      {/* Suggestions panel */}
      {panelOpen && matches.length > 0 && (
        <div className="mt-2 rounded-2xl border border-ic-rule bg-ic-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-ic-rule-soft flex items-center justify-between">
            <span className="font-mono text-[11px] text-ic-ink flex items-center gap-2">
              <Wand2 size={13} className="text-ic-accent" />
              Writing suggestions
            </span>
            <button
              type="button"
              onClick={() => { setMatches([]); setPanelOpen(false); }}
              className="font-mono text-[10px] text-ic-muted hover:text-ic-ink"
            >
              Dismiss all
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-ic-rule-soft">
            {(["spelling", "grammar", "punctuation", "style", "other"] as IssueType[]).map((type) => {
              const items = groups[type];
              if (!items.length) return null;
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 bg-ic-paper-deep">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ic-muted">
                      <span className={`h-1.5 w-1.5 rounded-full ${ISSUE_STYLES[type].dot}`} />
                      {issueLabels[type]}
                    </span>
                  </div>
                  {items.map(({ match: m, idx }) => {
                    const primary = m.replacements[0]?.value;
                    const isActive = activeIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveIdx(isActive ? null : idx)}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          isActive ? "bg-ic-accent/5" : "hover:bg-ic-paper-deep"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-ic-ink leading-snug">{m.message}</p>
                            <p className="font-mono text-[10px] text-ic-muted mt-0.5 truncate">
                              Original: &quot;{value.substr(m.offset, m.length)}&quot;
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); dismissMatch(idx); }}
                            className="shrink-0 text-ic-muted hover:text-ic-ink mt-0.5"
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                        {primary && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-mono text-[11px] text-ic-muted">Fix:</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${ISSUE_STYLES[type].badge}`}>
                              {primary}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); applySuggestion(idx, primary); }}
                              className="ml-auto flex items-center gap-1 font-mono text-[11px] font-semibold text-white
                                bg-ic-accent hover:opacity-90 px-3 py-1 rounded-lg transition-all"
                            >
                              <CheckCircle2 size={11} /> Apply
                            </button>
                          </div>
                        )}
                        {isActive && m.replacements.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="font-mono text-[10px] text-ic-muted w-full">Other suggestions:</span>
                            {m.replacements.slice(1, 5).map((r, ri) => (
                              <button
                                key={ri}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); applySuggestion(idx, r.value); }}
                                className="font-mono text-[11px] px-2 py-0.5 rounded-lg border border-ic-rule
                                  text-ic-muted hover:border-ic-accent hover:text-ic-accent transition-all"
                              >
                                {r.value}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {matches.length > 0 && (
            <div className="px-4 py-2 border-t border-ic-rule-soft bg-ic-paper-deep flex items-center gap-2">
              <AlertCircle size={11} className="text-ic-muted" />
              <span className="font-mono text-[10px] text-ic-muted">
                Powered by LanguageTool open-source engine. Click an underlined word in the editor to jump to it.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
