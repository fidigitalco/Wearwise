/**
 * The password rule, checked live on every form that sets a password. The server
 * enforces the same rule (backend api/passwords.py plus Django's validators), so
 * this is only there so nothing is a surprise at submit time.
 */
export type PwRule = 'length' | 'case' | 'digit' | 'symbol' | 'similar';
export type PwStrength = 'weak' | 'fair' | 'good' | 'strong';

export const PW_RULES: PwRule[] = ['length', 'case', 'digit', 'symbol', 'similar'];

export function passwordChecks(pw: string, about?: { email?: string; name?: string }): { failed: PwRule[]; strength: PwStrength } {
  const failed: PwRule[] = [];
  if (pw.length < 8) failed.push('length');
  if (!(/[a-z]/.test(pw) && /[A-Z]/.test(pw))) failed.push('case');
  if (!/\d/.test(pw)) failed.push('digit');
  // Anything that is not a letter, digit or space counts, so "!", "-" and "€" all qualify.
  if (!/[^\p{L}\d\s]|_/u.test(pw)) failed.push('symbol');
  // Close to Django's similarity check: no email name or name word inside the password.
  const parts = [about?.email?.split('@')[0], ...(about?.name?.split(/\s+/) ?? [])]
    .filter((x): x is string => !!x && x.length >= 3)
    .map((x) => x.toLowerCase());
  const low = pw.toLowerCase();
  if (pw && parts.some((x) => low.includes(x) || x.includes(low))) failed.push('similar');

  let strength: PwStrength = 'weak';
  if (!failed.length) strength = pw.length >= 16 ? 'strong' : pw.length >= 12 ? 'good' : 'fair';
  return { failed, strength };
}
