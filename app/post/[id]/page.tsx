'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addNotification,
  formatTimeAgo,
  getUnreadNotificationCount,
  initialiseBackendIdentity,
  loadPosts,
  loadSupabasePosts,
  PostItem,
  savePosts,
  STATION_NAMES,
} from '../../lib/banta';

type ThreadNode = {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
};

const THREAD_LAST_VIEWED_KEY = 'banta_thread_last_viewed';
const FLAGGED_POSTS_KEY = 'banta_flagged_posts';
const HIDDEN_POSTS_KEY = 'banta_hidden_posts';

function loadThreadLastViewed(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(THREAD_LAST_VIEWED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveThreadLastViewed(map: Record<string, number>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THREAD_LAST_VIEWED_KEY, JSON.stringify(map));
}

function loadIdList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveIdList(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
}

function hasId(key: string, id: string): boolean {
  return loadIdList(key).includes(id);
}

function toggleId(key: string, id: string) {
  const current = new Set(loadIdList(key));
  if (current.has(id)) current.delete(id);
  else current.add(id);
  saveIdList(key, Array.from(current));
}

function buildReplyTargetUser(
  postAuthor: string,
  comments: ThreadNode[],
  postText: string,
  parentId: string | null
) {
  if (!parentId) {
    return {
      toUser: postAuthor || null,
      parentText: postText,
    };
  }

  const parent = comments.find((c) => c.id === parentId);

  return {
    toUser: parent?.author || null,
    parentText: parent?.text || postText,
  };
}

function mergeSupabaseAndLocalPosts(
  supabasePosts: PostItem[],
  localPosts: PostItem[]
): PostItem[] {
  const localMap = new Map(localPosts.map((post) => [post.id, post]));
  const merged: PostItem[] = [];

  for (const supabasePost of supabasePosts) {
    const localMatch = localMap.get(supabasePost.id);

    merged.push({
      ...supabasePost,
      likes: localMatch?.likes ?? supabasePost.likes ?? 0,
      comments: localMatch?.comments ?? [],
      topic: localMatch?.topic || supabasePost.topic || '',
      sharedFromPostId: localMatch?.sharedFromPostId,
      sharedFromStationId: localMatch?.sharedFromStationId,
    });

    localMap.delete(supabasePost.id);
  }

  for (const remainingLocal of Array.from(localMap.values())) {
    merged.push(remainingLocal);
  }

  return merged;
}

export default function PostThreadPage({ params }: { params: { id: string } }) {
  const [mounted, setMounted] = useState(false);
  const [author, setAuthor] = useState('Peter T');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState<number>(0);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showHiddenPost, setShowHiddenPost] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const identity = await initialiseBackendIdentity();
      if (cancelled) return;

      const current = identity.author;
      const localPosts = loadPosts();

      setAuthor(current);
      setUnreadCount(getUnreadNotificationCount(current));
      setIsFlagged(hasId(FLAGGED_POSTS_KEY, params.id));
      setIsHidden(hasId(HIDDEN_POSTS_KEY, params.id));

      try {
        const supabasePosts = await loadSupabasePosts();
        if (cancelled) return;

        const mergedPosts = mergeSupabaseAndLocalPosts(
          supabasePosts,
          localPosts
        );
        setPosts(mergedPosts);
      } catch {
        if (cancelled) return;
        setPosts(localPosts);
      }
    };

    refresh();

    const viewedMap = loadThreadLastViewed();
    setLastViewedAt(
      typeof viewedMap[params.id] === 'number' ? viewedMap[params.id] : 0
    );

    setMounted(true);

    const onFocus = () => refresh();
    const onStorage = () => refresh();

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;

      const currentMap = loadThreadLastViewed();
      currentMap[params.id] = Date.now();
      saveThreadLastViewed(currentMap);

      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [params.id]);

  const post = useMemo(
    () => posts.find((item) => item.id === params.id),
    [posts, params.id]
  );

  const threadComments = useMemo<ThreadNode[]>(() => {
    if (!post) return [];
    return [...(post.comments || [])].sort((a, b) => a.createdAt - b.createdAt);
  }, [post]);

  const newReplyCount = useMemo(() => {
    if (!lastViewedAt) return 0;
    return threadComments.filter((comment) => comment.createdAt > lastViewedAt)
      .length;
  }, [threadComments, lastViewedAt]);

  function getChildren(parentId: string | null) {
    return threadComments.filter((comment) => comment.parentId === parentId);
  }

  function submitReply() {
    if (!post) return;
    const text = replyText.trim();
    if (!text) return;

    const newComment: ThreadNode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      postId: post.id,
      parentId: replyParentId,
      author,
      text,
      createdAt: Date.now(),
      likes: 0,
    };

    const localPosts = loadPosts();
    const existingLocalPost = localPosts.find((item) => item.id === post.id);

    const baseLocalPost: PostItem = existingLocalPost || {
      ...post,
      comments: threadComments,
      likes: post.likes || 0,
    };

    const nextLocalPost: PostItem = {
      ...baseLocalPost,
      comments: [...threadComments, newComment],
    };

    const nextPosts = [
      nextLocalPost,
      ...localPosts.filter((item) => item.id !== post.id),
    ];

    savePosts(nextPosts);

    const nextMergedPosts = posts.map((item) =>
      item.id === post.id
        ? {
            ...item,
            comments: [...threadComments, newComment],
          }
        : item
    );

    setPosts(nextMergedPosts);
    setReplyText('');

    const target = buildReplyTargetUser(
      post.author,
      threadComments,
      post.text,
      replyParentId
    );

    if (target.toUser && target.toUser !== author) {
      addNotification({
        type: 'reply',
        toUser: target.toUser,
        fromUser: author,
        postId: post.id,
        commentId: replyParentId || undefined,
        text,
      });
    }

    setReplyParentId(null);
  }

  function likePost() {
    if (!post) return;

    const localPosts = loadPosts();
    const existingLocalPost = localPosts.find((item) => item.id === post.id);

    const baseLocalPost: PostItem = existingLocalPost || {
      ...post,
      comments: threadComments,
      likes: post.likes || 0,
    };

    const nextPosts = [
      {
        ...baseLocalPost,
        likes: (baseLocalPost.likes || 0) + 1,
      },
      ...localPosts.filter((item) => item.id !== post.id),
    ];

    savePosts(nextPosts);

    const nextMerged = posts.map((item) =>
      item.id === post.id ? { ...item, likes: (item.likes || 0) + 1 } : item
    );

    setPosts(nextMerged);

    if (post.author && post.author !== author) {
      addNotification({
        type: 'like',
        toUser: post.author,
        fromUser: author,
        postId: post.id,
        text: 'liked your post',
      });
    }
  }

  function likeComment(commentId: string) {
    if (!post) return;

    const likedComment = threadComments.find(
      (comment) => comment.id === commentId
    );
    if (!likedComment) return;

    const updatedComments = threadComments.map((comment) =>
      comment.id === commentId
        ? { ...comment, likes: (comment.likes || 0) + 1 }
        : comment
    );

    const localPosts = loadPosts();
    const existingLocalPost = localPosts.find((item) => item.id === post.id);

    if (existingLocalPost) {
      const nextPosts = localPosts.map((item) => {
        if (item.id !== post.id) return item;

        return {
          ...item,
          comments: updatedComments,
        };
      });

      savePosts(nextPosts);
    }

    const nextMerged = posts.map((item) => {
      if (item.id !== post.id) return item;

      return {
        ...item,
        comments: updatedComments,
      };
    });

    setPosts(nextMerged);

    if (likedComment.author && likedComment.author !== author) {
      addNotification({
        type: 'like',
        toUser: likedComment.author,
        fromUser: author,
        postId: post.id,
        commentId: likedComment.id,
        text: 'liked your reply',
      });
    }
  }

  function deleteOwnComment(commentId: string) {
    if (!post) return;

    const idsToRemove = new Set<string>([commentId]);

    let changed = true;
    while (changed) {
      changed = false;
      for (const comment of threadComments) {
        if (
          comment.parentId &&
          idsToRemove.has(comment.parentId) &&
          !idsToRemove.has(comment.id)
        ) {
          idsToRemove.add(comment.id);
          changed = true;
        }
      }
    }

    const updatedComments = threadComments.filter(
      (comment) => !idsToRemove.has(comment.id)
    );

    const localPosts = loadPosts();
    const existingLocalPost = localPosts.find((item) => item.id === post.id);

    if (!existingLocalPost) return;

    const nextPosts = localPosts.map((item) => {
      if (item.id !== post.id) return item;
      return {
        ...item,
        comments: updatedComments,
      };
    });

    savePosts(nextPosts);

    const nextMerged = posts.map((item) => {
      if (item.id !== post.id) return item;
      return {
        ...item,
        comments: updatedComments,
      };
    });

    setPosts(nextMerged);
  }

  function handleToggleFlag() {
    toggleId(FLAGGED_POSTS_KEY, params.id);
    setIsFlagged(hasId(FLAGGED_POSTS_KEY, params.id));
  }

  function handleToggleHide() {
    toggleId(HIDDEN_POSTS_KEY, params.id);
    const nextHidden = hasId(HIDDEN_POSTS_KEY, params.id);
    setIsHidden(nextHidden);
    if (!nextHidden) {
      setShowHiddenPost(false);
    }
  }

  function renderBranch(parentId: string | null, depth = 0): JSX.Element[] {
    return getChildren(parentId).map((comment) => {
      const isNew = lastViewedAt > 0 && comment.createdAt > lastViewedAt;

      return (
        <div key={comment.id} style={{ marginLeft: depth * 18, marginTop: 12 }}>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 12,
              background: isNew ? '#f7fbff' : '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>
                  <Link
                    href={`/u/${encodeURIComponent(comment.author)}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {comment.author}
                  </Link>
                </strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  {formatTimeAgo(comment.createdAt)}
                  {isNew ? (
                    <span
                      style={{
                        marginLeft: 8,
                        display: 'inline-block',
                        border: '1px solid #c7defa',
                        background: '#eaf4ff',
                        color: '#1d4f91',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      New
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.45,
              }}
            >
              {comment.text}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={() => likeComment(comment.id)}
                style={{
                  border: '1px solid #ccc',
                  background: '#fff',
                  borderRadius: 999,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                ❤️ {comment.likes || 0}
              </button>

              <button
                onClick={() => setReplyParentId(comment.id)}
                style={{
                  border: '1px solid #ccc',
                  background: replyParentId === comment.id ? '#111' : '#fff',
                  color: replyParentId === comment.id ? '#fff' : '#111',
                  borderRadius: 999,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Reply
              </button>

              {comment.author === author ? (
                <button
                  onClick={() => deleteOwnComment(comment.id)}
                  style={{
                    border: '1px solid #ccc',
                    background: '#fff',
                    borderRadius: 999,
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          {renderBranch(comment.id, depth + 1)}
        </div>
      );
    });
  }

  if (!mounted) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 860,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p>Loading thread…</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 860,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <Link href="/feed">← Back to Feed</Link>
        <h1>Post not found</h1>
      </main>
    );
  }

  if (isHidden && !showHiddenPost) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 860,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/feed">← Back to Feed</Link>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/activity">
              Activity{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Link>
            <Link href={`/u/${encodeURIComponent(author)}`}>Profile</Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            border: '1px solid #ddd',
            borderRadius: 14,
            padding: 18,
            background: '#fafafa',
          }}
        >
          <h1 style={{ marginTop: 0 }}>This thread is hidden</h1>
          <p style={{ color: '#666', lineHeight: 1.45 }}>
            You hid this post from the normal feed. You can still reveal it
            here.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 12,
            }}
          >
            <button
              onClick={() => setShowHiddenPost(true)}
              style={{
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Show hidden thread
            </button>

            <button
              onClick={handleToggleHide}
              style={{
                border: '1px solid #ccc',
                background: '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Unhide
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 860,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/feed">← Back to Feed</Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/activity">
            Activity{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Link>
          <Link href={`/u/${encodeURIComponent(author)}`}>Profile</Link>
        </div>
      </div>

      <article
        style={{
          marginTop: 16,
          border: '1px solid #ddd',
          borderRadius: 14,
          padding: 16,
          background: isFlagged ? '#fffaf0' : '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>
              <Link
                href={`/u/${encodeURIComponent(post.author)}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {post.author}
              </Link>
            </strong>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {post.topic ? (
                <>
                  <Link
                    href={`/topic/${encodeURIComponent(post.topic)}`}
                    style={{ color: 'inherit' }}
                  >
                    {post.topic}
                  </Link>
                  {' • '}
                </>
              ) : null}
              via {STATION_NAMES[post.stationId] || post.stationId} •{' '}
              {formatTimeAgo(post.createdAt)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isFlagged ? (
              <span
                style={{
                  border: '1px solid #f1d39b',
                  background: '#fff3d6',
                  color: '#8a5a00',
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Flagged
              </span>
            ) : null}

            {isHidden ? (
              <span
                style={{
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  color: '#666',
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Hidden
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {post.text}
        </div>

        <div
          style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}
        >
          <button
            onClick={likePost}
            style={{
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            ❤️ {post.likes || 0}
          </button>

          <button
            onClick={() => setReplyParentId(null)}
            style={{
              border: '1px solid #ccc',
              background: replyParentId === null ? '#111' : '#fff',
              color: replyParentId === null ? '#fff' : '#111',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Reply to post
          </button>

          <button
            onClick={handleToggleFlag}
            style={{
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            {isFlagged ? 'Unflag' : 'Flag'}
          </button>

          <button
            onClick={handleToggleHide}
            style={{
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            {isHidden ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </article>

      <section style={{ marginTop: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0 }}>Replies ({threadComments.length})</h2>

          {newReplyCount > 0 ? (
            <div
              style={{
                border: '1px solid #c7defa',
                background: '#eaf4ff',
                color: '#1d4f91',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {newReplyCount} new {newReplyCount === 1 ? 'reply' : 'replies'}{' '}
              since last visit
            </div>
          ) : null}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 14,
            padding: 14,
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {replyParentId
              ? 'Replying to a comment'
              : 'Replying to the main post'}
          </div>

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={4}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 10,
              border: '1px solid #ccc',
              resize: 'vertical',
              font: 'inherit',
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={submitReply}
              style={{
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Post reply
            </button>

            {replyParentId ? (
              <button
                onClick={() => setReplyParentId(null)}
                style={{
                  border: '1px solid #ccc',
                  background: '#fff',
                  borderRadius: 999,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Cancel nested reply
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>{renderBranch(null)}</div>
      </section>
    </main>
  );
}
