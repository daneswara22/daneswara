'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChatInbox from '@/src_pages/ChatInbox';

// Inbox chat pelanggan untuk admin (/app/chat).
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager', 'Kasir']}>
      <ChatInbox />
    </ProtectedRoute>
  );
}
