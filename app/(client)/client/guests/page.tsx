import { redirect } from 'next/navigation';

export default function ClientGuestsRedirectPage() {
  redirect('/client?tab=guests');
}
