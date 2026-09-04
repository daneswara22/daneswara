import AppLayoutClient from './AppLayoutClient';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
