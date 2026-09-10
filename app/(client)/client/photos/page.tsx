import { redirect } from 'next/navigation';

export default function ClientPhotosRedirectPage() {
  redirect('/client?tab=photos');
}
