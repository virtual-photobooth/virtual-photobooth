import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virtual Photobooth',
  description: 'Capture photobooth memories and leave voice messages',
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
