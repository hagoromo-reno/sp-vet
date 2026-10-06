/**
 * Utilitários de identificação do aparelho via Cookies / LocalStorage
 * para turmas e logins compartilhados de alunos (alunos@sopet.app).
 */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

export function getDeviceId(): string {
  let devId = getCookie('spvet_device_id');
  if (!devId && typeof localStorage !== 'undefined') {
    devId = localStorage.getItem('spvet_device_id');
  }
  if (!devId) {
    devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  // Garante persistência em ambos
  setCookie('spvet_device_id', devId, 365);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('spvet_device_id', devId);
  }
  return devId;
}

export function getStudentName(): string {
  let name = getCookie('spvet_student_name');
  if (!name && typeof localStorage !== 'undefined') {
    name = localStorage.getItem('spvet_student_name');
  }
  return (name || '').trim();
}

export function setStudentName(name: string): void {
  const cleanName = (name || '').trim();
  if (cleanName) {
    setCookie('spvet_student_name', cleanName, 365);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spvet_student_name', cleanName);
    }
  } else {
    clearStudentName();
  }
}

export function clearStudentName(): void {
  removeCookie('spvet_student_name');
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('spvet_student_name');
  }
}
