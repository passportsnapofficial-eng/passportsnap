import { supabase } from './client.js';

function fallbackNameFromEmail(email = '') {
  const [rawName = 'Account'] = String(email).split('@');
  const cleaned = rawName.replace(/[._-]+/g, ' ').trim();
  return cleaned
    ? cleaned.replace(/\b\w/g, (character) => character.toUpperCase())
    : 'Account';
}

export function toAppUser(authUser, profile) {
  if (!authUser) return null;

  const metadata = authUser.user_metadata || {};
  const fullName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    fallbackNameFromEmail(authUser.email);

  return {
    id: authUser.id,
    name: fullName,
    email: authUser.email || profile?.email || '',
    phone: profile?.phone || metadata.phone || '',
    role: profile?.role || 'user',
  };
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProfile({ id, email, fullName, phone, role = 'user' }) {
  const payload = {
    id,
    email,
    full_name: fullName?.trim() || null,
    phone: phone?.trim() || null,
    role,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function syncProfileFromAuthUser(authUser) {
  if (!authUser) return null;

  const metadata = authUser.user_metadata || {};

  try {
    const existingProfile = await getProfile(authUser.id);
    if (existingProfile) return existingProfile;
  } catch {
    // Fall through to create the profile.
  }

  return upsertProfile({
    id: authUser.id,
    email: authUser.email || '',
    fullName: metadata.full_name || metadata.name || '',
    phone: metadata.phone || '',
    role: 'user',
  });
}
