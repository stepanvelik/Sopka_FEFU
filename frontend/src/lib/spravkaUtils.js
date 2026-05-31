import { downloadStudentSpravka } from './api.js';

export function triggerSpravkaDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSpravkaForStudent({
  studentId,
  eventId,
  dateFrom = '',
  dateTo = '',
}) {
  const { blob, filename } = await downloadStudentSpravka({
    studentId,
    eventId,
    dateFrom,
    dateTo,
  });
  triggerSpravkaDownload(blob, filename);
}
