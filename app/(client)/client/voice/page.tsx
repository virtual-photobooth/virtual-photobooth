import { redirect } from 'next/navigation';

export default function ClientVoiceRedirectPage() {
  redirect('/client?tab=photos');
}
