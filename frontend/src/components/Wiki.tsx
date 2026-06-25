/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, FileText, ChevronRight, ChevronDown, Edit3, Eye, 
  Trash2, Search, Calendar, User, Save, CornerDownRight, BookCheck, Clock
} from 'lucide-react';
import { WikiPage } from '../types';
import { fetchWikiPages, saveWikiPage, deleteWikiPage } from '../api';
import { socket } from '../utils/socket';

export default function Wiki() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  
  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load wiki pages on boot
  useEffect(() => {
    loadWiki();
  }, []);

  // Real-time Wiki syncing via WebSockets
  useEffect(() => {
    const handleWikiUpdated = (updatedWiki: WikiPage) => {
      setPages(prev => {
        const idx = prev.findIndex(w => w.id === updatedWiki.id);
        if (idx >= 0) return prev.map(w => w.id === updatedWiki.id ? updatedWiki : w);
        return [...prev, updatedWiki].sort((a, b) => a.title.localeCompare(b.title));
      });
      setSelectedPage(current => {
        if (current && current.id === updatedWiki.id && !isEditing) return updatedWiki;
        return current;
      });
    };

    const handleWikiDeleted = (deletedId: string) => {
      setPages(prev => prev.filter(w => w.id !== deletedId));
      setSelectedPage(current => (current && current.id === deletedId ? null : current));
    };

    socket.on('wiki:updated', handleWikiUpdated);
    socket.on('wiki:deleted', handleWikiDeleted);

    return () => {
      socket.off('wiki:updated', handleWikiUpdated);
      socket.off('wiki:deleted', handleWikiDeleted);
    };
  }, [isEditing]);

  const loadWiki = async () => {
    try {
      const data = await fetchWikiPages();
      setPages(data);
      if (data.length > 0 && !selectedPage) {
        // Set welcome guide as default if available
        const welcome = data.find(p => p.id === 'w1') || data[0];
        selectPage(welcome);
      }
    } catch (err) {
      console.error('Error fetching wiki pages:', err);
    }
  };

  const selectPage = (page: WikiPage) => {
    setSelectedPage(page);
    setEditTitle(page.title);
    setEditContent(page.content);
    setEditParentId(page.parentId);
    setIsEditing(false);
    setSaveStatus('idle');
  };

  const handleCreatePage = async (parentId: string | null = null) => {
    try {
      const newPage: Partial<WikiPage> = {
        title: parentId ? 'New Sub-page' : 'Untitled Document',
        content: '# New Document\n\nWrite your thoughts here...',
        parentId: parentId,
        updatedAt: 'Just now',
        updatedBy: 'Alex Rivera'
      };
      const saved = await saveWikiPage(newPage);
      
      // Update local pages list
      const updatedList = await fetchWikiPages();
      setPages(updatedList);
      
      // Auto-select and open the new page in edit mode
      selectPage(saved);
      setIsEditing(true);

      // Expand parent if creating sub-page
      if (parentId) {
        setExpandedPages(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (err) {
      console.error('Failed to create wiki page:', err);
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;
    setSaveStatus('saving');
    try {
      const updated: Partial<WikiPage> = {
        id: selectedPage.id,
        title: editTitle.trim() || 'Untitled Document',
        content: editContent,
        parentId: editParentId,
        updatedAt: 'Just now',
        updatedBy: 'Alex Rivera'
      };
      const saved = await saveWikiPage(updated);
      
      // Reload wiki pages
      const updatedList = await fetchWikiPages();
      setPages(updatedList);
      
      // Update selected state
      setSelectedPage(saved);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save page:', err);
      setSaveStatus('error');
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page and all of its sub-pages?')) return;
    try {
      await deleteWikiPage(id);
      
      // If we deleted the current page, clear or select another
      const remaining = pages.filter(p => p.id !== id && p.parentId !== id);
      setPages(remaining);
      
      if (selectedPage?.id === id) {
        if (remaining.length > 0) {
          selectPage(remaining[0]);
        } else {
          setSelectedPage(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete page:', err);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Build tree structures for hierarchical display
  const getSubPages = (parentId: string | null) => {
    return pages.filter(p => p.parentId === parentId);
  };

  // Filter pages by search input
  const filteredPages = pages.filter(p => 
    p.title.toLowerCase().includes(searchVal.toLowerCase()) || 
    p.content.toLowerCase().includes(searchVal.toLowerCase())
  );

  // Render a simple formatted preview of the markdown
  const renderMarkdownPreview = (text: string) => {
    if (!text) return <p className="text-on-surface-variant italic">No content written yet.</p>;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-3xl font-extrabold text-on-surface mt-6 mb-3 pb-2 border-b border-outline-variant/30 font-sans">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-2xl font-bold text-on-surface mt-5 mb-2 font-sans">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-xl font-bold text-on-surface mt-4 mb-2 font-sans">{line.replace('### ', '')}</h3>;
      }
      
      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-primary bg-surface-container-high/40 px-4 py-2 my-3 rounded-r text-on-surface-variant font-sans italic">
            {line.replace('> ', '')}
          </blockquote>
        );
      }

      // Code blocks (inline style simplified)
      if (line.startsWith('```')) {
        if (line.length > 3) return null; // skip opening
        return null; // skip closing
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <ul key={idx} className="list-disc pl-6 my-1 text-on-surface-variant font-sans">
            <li>{line.substring(2)}</li>
          </ul>
        );
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        return (
          <ol key={idx} className="list-decimal pl-6 my-1 text-on-surface-variant font-sans">
            <li>{line.replace(/^\d+\.\s/, '')}</li>
          </ol>
        );
      }

      // Empty line
      if (line.trim() === '') {
        return <div key={idx} className="h-2"></div>;
      }

      // Normal paragraph
      return <p key={idx} className="my-2 leading-relaxed text-on-surface-variant text-base font-sans">{line}</p>;
    });
  };

  // Recursive page renderer for the tree Sidebar
  const renderPageTree = (parentId: string | null, depth = 0) => {
    const subPages = getSubPages(parentId);
    if (subPages.length === 0) return null;

    return (
      <ul className="space-y-1 mt-1">
        {subPages.map(page => {
          const hasChildren = getSubPages(page.id).length > 0;
          const isExpanded = !!expandedPages[page.id];
          const isCurrent = selectedPage?.id === page.id;

          return (
            <li key={page.id} className="select-none">
              <div 
                onClick={() => selectPage(page)}
                className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                  isCurrent 
                    ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
                style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  {hasChildren ? (
                    <button 
                      onClick={(e) => toggleExpand(page.id, e)}
                      className="p-0.5 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <FileText size={14} className="opacity-50 flex-shrink-0" />
                  )}
                  <span className="truncate">{page.title}</span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreatePage(page.id);
                    }}
                    title="Add sub-page"
                    className="p-1 hover:bg-surface-container-highest text-on-surface-variant hover:text-primary rounded"
                  >
                    <Plus size={12} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(page.id);
                    }}
                    title="Delete page"
                    className="p-1 hover:bg-error/15 text-on-surface-variant hover:text-error rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Nested Pages */}
              {hasChildren && isExpanded && (
                <div className="overflow-hidden">
                  {renderPageTree(page.id, depth + 1)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="flex h-full w-full bg-surface-container-lowest/10 text-on-surface overflow-hidden"
    >
      {/* Wiki Explorer Sidebar */}
      <div className="w-64 border-r border-outline-variant bg-surface-container-low flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen size={18} className="stroke-[2.5]" />
            <span className="font-bold text-sm uppercase tracking-wider">Knowledge Base</span>
          </div>
          <button 
            onClick={() => handleCreatePage(null)}
            className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all border border-primary/25 cursor-pointer"
            title="Create root document"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Wiki Search */}
        <div className="p-3 border-b border-outline-variant/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-on-surface-variant/60" size={15} />
            <input 
              type="text" 
              placeholder="Search wiki..." 
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-xs focus:outline-none focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant/40"
            />
          </div>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto p-3">
          {searchVal.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant/50 px-2">Search Results</span>
              {filteredPages.length === 0 ? (
                <p className="text-xs text-on-surface-variant/40 italic p-2">No pages match your search.</p>
              ) : (
                filteredPages.map(page => (
                  <div 
                    key={page.id}
                    onClick={() => selectPage(page)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-container-high/50 rounded-lg text-xs font-medium cursor-pointer text-on-surface-variant hover:text-on-surface"
                  >
                    <FileText size={12} className="opacity-50" />
                    <span className="truncate">{page.title}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant/50 px-2 block mb-1">Documents</span>
              {pages.length === 0 ? (
                <p className="text-xs text-on-surface-variant/40 italic p-2">No documents yet. Create one!</p>
              ) : (
                renderPageTree(null)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Wiki Document Viewport */}
      <div className="flex-1 flex flex-col h-full bg-surface-container-lowest/30 overflow-hidden">
        {selectedPage ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header controls bar */}
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest/40">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono">
                <Calendar size={13} />
                <span>Updated: {selectedPage.updatedAt}</span>
                <span className="opacity-30">|</span>
                <User size={13} />
                <span>By: {selectedPage.updatedBy}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isEditing ? (
                    <>
                      <Eye size={14} />
                      <span>Preview Mode</span>
                    </>
                  ) : (
                    <>
                      <Edit3 size={14} className="text-primary" />
                      <span>Edit Content</span>
                    </>
                  )}
                </button>

                {isEditing && (
                  <button
                    onClick={handleSavePage}
                    disabled={saveStatus === 'saving'}
                    className={`px-3 py-1.5 text-on-primary rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                      saveStatus === 'saved' 
                        ? 'bg-secondary text-on-secondary' 
                        : 'bg-primary hover:bg-primary/95 text-on-primary'
                    }`}
                  >
                    {saveStatus === 'saving' ? (
                      <span>Saving...</span>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <BookCheck size={14} />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Save Document</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => handleDeletePage(selectedPage.id)}
                  title="Delete Document"
                  className="p-1.5 hover:bg-error/15 border border-outline-variant/10 text-on-surface-variant hover:text-error rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Document Editor / View Canvas */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto">
              {isEditing ? (
                <div className="space-y-6 h-full flex flex-col">
                  {/* Title editor */}
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Document Title"
                    className="w-full text-4xl font-extrabold bg-transparent text-on-surface focus:outline-none placeholder:text-on-surface-variant/30 font-sans border-b border-transparent focus:border-primary/20 pb-2"
                  />

                  {/* Parent Selector */}
                  <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant/35 p-3 rounded-xl text-xs text-on-surface-variant">
                    <span className="font-bold text-[10px] uppercase text-primary tracking-wider">Parent Page:</span>
                    <select
                      value={editParentId || ''}
                      onChange={(e) => setEditParentId(e.target.value || null)}
                      className="bg-surface-container-lowest border border-outline-variant/40 text-on-surface rounded p-1.5 focus:outline-none focus:border-primary/45"
                    >
                      <option value="">None (Root Document)</option>
                      {pages
                        .filter(p => p.id !== selectedPage.id) // Cannot be own parent
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Body Textarea */}
                  <div className="flex-1 flex flex-col min-h-[350px]">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant/45 mb-1.5 block">Document Markdown (Supports Headers, Lists, Quotes)</span>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Write your document content here using Markdown formatting..."
                      className="w-full flex-1 p-4 bg-surface-container-lowest border border-outline-variant/45 rounded-xl font-mono text-sm focus:outline-none focus:border-primary/50 text-on-surface resize-none leading-relaxed placeholder:text-on-surface-variant/30"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Document Title Header */}
                  <div className="space-y-2">
                    {selectedPage.parentId && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <CornerDownRight size={12} />
                        <span>Sub-page of:</span>
                        <span 
                          onClick={() => {
                            const parent = pages.find(p => p.id === selectedPage.parentId);
                            if (parent) selectPage(parent);
                          }}
                          className="hover:underline cursor-pointer"
                        >
                          {pages.find(p => p.id === selectedPage.parentId)?.title || 'Parent Document'}
                        </span>
                      </div>
                    )}
                    <h1 className="text-4xl font-extrabold text-on-surface tracking-tight font-sans leading-tight">
                      {selectedPage.title}
                    </h1>
                  </div>

                  {/* Rich formatted render view */}
                  <div className="prose prose-invert max-w-none mt-6 space-y-4">
                    {renderMarkdownPreview(selectedPage.content)}
                  </div>

                  {/* Subpages references */}
                  {getSubPages(selectedPage.id).length > 0 && (
                    <div className="mt-12 pt-6 border-t border-outline-variant/20">
                      <h4 className="text-xs uppercase font-extrabold text-primary tracking-wider mb-3">Nested Sub-pages</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {getSubPages(selectedPage.id).map(sub => (
                          <div
                            key={sub.id}
                            onClick={() => selectPage(sub)}
                            className="p-3 bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-surface-container-high/40 transition-all group"
                          >
                            <FileText size={16} className="text-on-surface-variant group-hover:text-primary transition-colors animate-fade-in" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">{sub.title}</p>
                              <p className="text-[10px] text-on-surface-variant truncate font-mono">Updated: {sub.updatedAt}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
            <BookOpen size={48} className="text-outline/40 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold">No Wiki Documents Found</h3>
            <p className="text-sm text-on-surface-variant/60 max-w-md mt-1">
              Create your first root document to start writing guides, templates, and specifications.
            </p>
            <button
              onClick={() => handleCreatePage(null)}
              className="mt-4 px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <Plus size={16} />
              <span>Create Document</span>
            </button>
          </div>
        )}
      </div>

      {/* Recent Updates Panel */}
      <div className="w-64 border-l border-outline-variant bg-surface-container-low/75 hidden xl:flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-outline-variant/30 flex items-center gap-2 text-on-surface">
          <Clock size={16} className="text-primary" />
          <span className="font-bold text-xs uppercase tracking-wider">Recent Wiki Updates</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pages
            .slice(0, 5) // Show top 5 modified pages
            .map(page => (
              <div 
                key={page.id}
                onClick={() => selectPage(page)}
                className="group border border-outline-variant/15 bg-surface-container-low hover:bg-surface-container-high/60 p-3 rounded-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={12} className="text-primary flex-shrink-0" />
                  <p className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">{page.title}</p>
                </div>
                <div className="flex items-center justify-between text-[9px] text-on-surface-variant/75 font-mono">
                  <span>@{page.updatedBy.split(' ')[0]}</span>
                  <span>{page.updatedAt}</span>
                </div>
              </div>
            ))
          }
          {pages.length === 0 && (
            <p className="text-xs text-on-surface-variant/40 italic text-center py-4">No recent updates.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
