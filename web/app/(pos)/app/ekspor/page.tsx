'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import ExportData from '@/src_pages/ExportData';
export default function Page() {
  return <ProtectedRoute roles={['Owner']}><ExportData /></ProtectedRoute>;
}
