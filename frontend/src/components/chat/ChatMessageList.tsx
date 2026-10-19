import React from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Trash2, Sparkles } from 'lucide-react';
import { Message, User } from '../../types';

interface ChatMessageListProps {
  isLoading: boolean;
  messages: Message[];
  currentUser: User | null;
  isAdmin: boolean;
  isAiTypingHere: boolean;
  geminiCopilot: User;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onDeleteMessage: (messageId: string) => void;
}

function renderMessageContent(content: string) {
  const parts = content.split(/(@[a-zA-Z0-9_.-]+)/g);
  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span
        key={`${part}-${index}`}
        className="text-primary font-semibold bg-primary/15 rounded px-1"
      >
        {part}
      </span>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

export default function ChatMessageList({
  isLoading,
  messages,
  currentUser,
  isAdmin,
  isAiTypingHere,
  geminiCopilot,
  chatEndRef,
  onDeleteMessage,
}: ChatMessageListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-outline-variant/30 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-outline-variant/30 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-outline-variant/20 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-outline-variant" />
            <span className="flex-shrink mx-4 text-[11px] font-mono text-on-surface-variant tabular-nums">
              Active Stream
            </span>
            <div className="flex-grow border-t border-outline-variant" />
          </div>

          {messages.map((message) => {
            const isOwnMessage = message.user.id === currentUser?.id;
            const canDelete = isOwnMessage || isAdmin;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                key={message.id}
                className="flex gap-3.5 group hover:bg-surface-container-low p-2.5 -mx-2.5 rounded-xl transition-colors relative"
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant">
                  <img
                    src={
                      message.user.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${message.user.name}`
                    }
                    alt={message.user.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">
                      {message.user.name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-mono tabular-nums">
                      {message.timestamp}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                    {renderMessageContent(message.content)}
                  </p>

                  {message.codeSnippet && (
                    <div className="mt-3 p-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl font-mono text-xs text-on-surface-variant overflow-x-auto select-all">
                      <pre className="whitespace-pre">
                        <code>{message.codeSnippet}</code>
                      </pre>
                    </div>
                  )}

                  {message.fileAttachment && (
                    <div className="mt-3 p-3 bg-surface-container-low border border-outline-variant rounded-xl w-fit flex items-center gap-4 hover:border-primary/40 transition-colors">
                      <div className="w-9 h-9 bg-primary/15 rounded-lg flex items-center justify-center text-primary">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-on-surface">
                          {message.fileAttachment.name}
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono tabular-nums mt-0.5">
                          {message.fileAttachment.size} · {message.fileAttachment.type}
                        </div>
                      </div>
                      <button
                        type="button"
                        title="Download Attachment"
                        className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  )}

                  {message.reactions && message.reactions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {message.reactions.map((reaction, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-surface-container border border-outline-variant rounded-md text-[11px] flex items-center gap-1 font-mono tabular-nums"
                        >
                          <span>{reaction.emoji}</span>
                          <span className="text-on-surface-variant font-semibold">
                            {reaction.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(message.id)}
                    title="Delete message"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-error/15 text-on-surface-variant hover:text-error transition-opacity cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </motion.div>
            );
          })}

          {isAiTypingHere && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl w-fit"
            >
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-primary/40 flex-shrink-0">
                <img
                  src={geminiCopilot.avatar}
                  alt="Gemini Copilot"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-primary font-mono">
                <Sparkles size={13} className="animate-spin" />
                <span>@gemini is analyzing thread &amp; generating response...</span>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </>
      )}
    </div>
  );
}
