'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import TaskToDo from '@/src_pages/TaskToDo';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir','Gudang']}><TaskToDo /></ProtectedRoute>;
}
