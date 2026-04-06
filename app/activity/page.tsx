'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  formatTimeAgo,
  getCurrentAuthor,
  getNotificationsForUser,
  markNotificationsRead,
  NotificationItem,
} from '../lib/banta';

function getNotificationTitle(item: NotificationItem) {
  if (item.type === 'follow') return 'New follower';
  if (item.type === 'reply') return 'New reply';
  if (item.type === 'like') return 'New like';
  return 'New activity';
}

function getNotificationBody(item: NotificationItem) {
  if (item.type === 'follow') {
    return (
      <>
        <strong>{item.fromUser}</strong> followed you.
      </>
    );
  }

  if (item.type === 'reply') {
    return (
      <>
        <strong>{item.fromUser}</strong> replied to your thread.
      </>
    );
  }

  if (item.type === 'like') {
    return (
      <>
        <strong>{item.fromUser}</strong>{' '}
        {item.commentId ? 'liked your reply.' : 'liked your post.'}
      </>
    );
  }

  return (
    <>
      <strong>{item.fromUser}</strong> interacted with your content.
    </>
  );
}

export default function ActivityPage() {
  const [author, setAuthor] = useState('Anonymous');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = getCurrentAuthor();
    setAuthor(current);
    markNotificationsRead(current);
    setItems(getNotificationsForUser(current));
    setMounted(true);
  }, []);

  const replyCount = useMemo(
    () => items.filter((item) => item.type === 'reply').length,
    [items]
  );

  const followCount = useMemo(
    () => items.filter((item) => item.type === 'follow').length,
    [items]
  );

  const likeCount = useMemo(
    () => items.filter((item) => item.type === 'like').length,
    [items]
  );

  if (!mounted) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 760,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p>Loading activity…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 760,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <Link href="/feed">← Back to Feed</Link>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/compose">+ New post</Link>
          <Link href={`/u/${encodeURIComponent(author)}`}>Profile</Link>
        </div>
      </div>

      <h1 style={{ marginBottom: 8 }}>Activity</h1>

      <p style={{ marginTop: 0, color: '#666' }}>
        Signed in as <strong>{author}</strong>
      </p>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 13,
            background: '#fff',
          }}
        >
          Total {items.length}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 13,
            background: '#fff',
          }}
        >
          Replies {replyCount}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 13,
            background: '#fff',
          }}
        >
          Followers {followCount}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 13,
            background: '#fff',
          }}
        >
          Likes {likeCount}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            padding: 18,
            border: '1px solid #ddd',
            borderRadius: 12,
            background: '#fafafa',
          }}
        >
          <strong>No activity yet.</strong>
          <p style={{ marginBottom: 0, color: '#666', lineHeight: 1.45 }}>
            When someone follows you, replies, or likes your content, it will
            show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {items.map((item, index) => {
            const href = item.postId
              ? `/post/${item.postId}`
              : `/u/${encodeURIComponent(item.fromUser)}`;

            const isRecent = index < 3;

            return (
              <Link
                key={item.id}
                href={href}
                style={{
                  display: 'block',
                  padding: 14,
                  border: '1px solid #ddd',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: isRecent ? '#f7fbff' : '#fff',
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
                  <div
                    style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                  >
                    <strong>{getNotificationTitle(item)}</strong>

                    {isRecent ? (
                      <span
                        style={{
                          border: '1px solid #c7defa',
                          background: '#eaf4ff',
                          color: '#1d4f91',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Recent
                      </span>
                    ) : null}
                  </div>

                  <span style={{ color: '#666', fontSize: 13 }}>
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>

                <div style={{ marginTop: 8, lineHeight: 1.45 }}>
                  {getNotificationBody(item)}
                </div>

                {item.type === 'reply' && item.text ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: '#fafafa',
                      color: '#333',
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    “{item.text}”
                  </div>
                ) : null}

                <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
                  {item.type === 'follow' ? 'Open profile' : 'Open thread'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
