'use client';

import type { PresenceUser } from '@/lib/realtime';

interface PresenceAvatarsProps {
  users: PresenceUser[];
  currentUserId: string;
  maxVisible?: number;
  /** When true, include the signed-in user in the stack (recommended for doc header). */
  showSelf?: boolean;
}

// Display pattern notes:
// - We overlap avatars with -space-x-2 to convey "group" rather than
//   "list" — same idiom Figma, Notion, and Linear use.
// - By default we include you in the stack so the header shows everyone
//   in the session in one place (not a separate "me" chip).
// - Order: other collaborators first, then you on the right so your
//   avatar sits on top of the stack.
// - We cap the visible count from the right and spill into a "+N" chip.
export default function PresenceAvatars({
  users,
  currentUserId,
  maxVisible = 6,
  showSelf = true,
}: PresenceAvatarsProps) {
  const inSession = showSelf
    ? users
    : users.filter((u) => u.user_id !== currentUserId);
  if (inSession.length === 0) return null;

  const others = inSession
    .filter((u) => u.user_id !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const me = showSelf ? inSession.find((u) => u.user_id === currentUserId) : undefined;
  const ordered = me ? [...others, me] : others;

  const overflow = Math.max(0, ordered.length - maxVisible);
  const visible = ordered.slice(ordered.length - maxVisible);

  return (
    <div className="flex items-center -space-x-2">
      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full bg-zinc-200 border-2 border-white flex items-center
                     justify-center text-[10px] font-bold text-zinc-600 ring-1 ring-black/5 z-0"
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
      {visible.map((u) => {
        const isSelf = currentUserId !== '' && u.user_id === currentUserId;
        const titleBits = [u.name, u.email && u.email.length > 0 ? u.email : null, isSelf ? 'You' : null].filter(
          Boolean,
        );
        return (
          <div
            key={u.user_id}
            title={titleBits.join(' · ')}
            className={`relative w-7 h-7 rounded-full border-2 border-white flex items-center justify-center
                       text-[10px] font-bold text-white ${
                         isSelf ? 'ring-2 ring-white shadow-sm' : 'ring-1 ring-black/5'
                       }`}
            style={{ backgroundColor: u.color }}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}
