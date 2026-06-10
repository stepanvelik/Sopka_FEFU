const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = 'Не удалось выполнить запрос.';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      } else if (Array.isArray(payload?.detail)) {
        message = payload.detail
          .map((item) => item?.msg)
          .filter(Boolean)
          .join(' ') || message;
      }
    } catch {
      // Ignore non-JSON errors and keep the fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function createStudent(payload) {
  return request('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function findOrCreateStudent(payload) {
  return request('/students/find-or-create', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getStudent(studentId) {
  return request(`/students/${studentId}`);
}

export async function updateStudent(studentId, payload) {
  return request(`/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function listStudents({ skip = 0, limit = 200, isActive = null } = {}) {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });

  if (isActive !== null) {
    params.set('is_active', String(isActive));
  }

  return request(`/students?${params.toString()}`);
}

export async function createBankDetails(studentId, payload) {
  return request(`/students/${studentId}/bank-details`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function updateBankDetails(bankDetailsId, payload) {
  return request(`/bank-details/${bankDetailsId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function listBankDetails(studentId, { activeOnly = null } = {}) {
  const params = new URLSearchParams();

  if (activeOnly !== null) {
    params.set('active_only', String(activeOnly));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/students/${studentId}/bank-details${suffix}`);
}

export async function importStudentsExcel(file, { mode = 'update' } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`/students/import?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: formData,
  });
}

export async function createEvent(payload) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function listEvents({ skip = 0, limit = 50 } = {}) {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });
  return request(`/events?${params.toString()}`);
}

export async function getEvent(eventId) {
  return request(`/events/${eventId}`);
}

export async function updateEvent(eventId, payload) {
  return request(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function deleteEvent(eventId) {
  return request(`/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function listEventParticipants(eventId) {
  return request(`/events/${eventId}/participants`);
}

export async function createEventParticipant(eventId, payload) {
  return request(`/events/${eventId}/participants`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function updateEventParticipant(eventId, participationId, payload) {
  return request(`/events/${eventId}/participants/${participationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function deleteEventParticipant(eventId, participationId) {
  return request(`/events/${eventId}/participants/${participationId}`, {
    method: 'DELETE',
  });
}

export async function listEventTypes({ skip = 0, limit = 50, isActive = null } = {}) {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });
  if (isActive !== null) {
    params.set('is_active', String(isActive));
  }
  return request(`/event-types?${params.toString()}`);
}

export async function createEventType(payload) {
  return request('/event-types', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function getEventType(eventTypeId) {
  return request(`/event-types/${eventTypeId}`);
}

export async function getParticipantsSummaryReport({
  search = '',
  dateFrom = '',
  dateTo = '',
  eventLevel = '',
  eventTypeId = '',
} = {}) {
  const params = new URLSearchParams();

  if (search) {
    params.set('search', search);
  }
  if (dateFrom) {
    params.set('date_from', dateFrom);
  }
  if (dateTo) {
    params.set('date_to', dateTo);
  }
  if (eventLevel) {
    params.set('event_level', eventLevel);
  }
  if (eventTypeId) {
    params.set('event_type_id', String(eventTypeId));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/reports/participants-summary${suffix}`);
}

export async function getStudentEventsReport({
  search = '',
  studentId = '',
  dateFrom = '',
  dateTo = '',
  eventLevel = '',
  eventTypeId = '',
} = {}) {
  const params = new URLSearchParams();

  if (search) {
    params.set('search', search);
  }
  if (studentId) {
    params.set('student_id', String(studentId));
  }
  if (dateFrom) {
    params.set('date_from', dateFrom);
  }
  if (dateTo) {
    params.set('date_to', dateTo);
  }
  if (eventLevel) {
    params.set('event_level', eventLevel);
  }
  if (eventTypeId) {
    params.set('event_type_id', String(eventTypeId));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/reports/student-events${suffix}`);
}

export async function downloadStudentSpravka({
  studentId,
  eventId,
  dateFrom = '',
  dateTo = '',
} = {}) {
  const params = new URLSearchParams({
    student_id: String(studentId),
    event_id: String(eventId),
  });

  if (dateFrom) {
    params.set('date_from', dateFrom);
  }
  if (dateTo) {
    params.set('date_to', dateTo);
  }

  const response = await fetch(`${API_BASE_URL}/reports/student-events/spravka?${params.toString()}`);
  if (!response.ok) {
    let message = 'Не удалось сформировать справку.';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Keep fallback message for non-JSON errors.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const rawName = utfMatch?.[1] || plainMatch?.[1] || 'Справка.docx';
  const filename = decodeURIComponent(rawName);

  return { blob, filename };
}

export async function downloadEventSpravkiArchive({
  eventId,
  roleName = '',
  dateFrom = '',
  dateTo = '',
  studentIds = [],
} = {}) {
  const params = new URLSearchParams();

  if (roleName) {
    params.set('role_name', roleName);
  }
  if (dateFrom) {
    params.set('date_from', dateFrom);
  }
  if (dateTo) {
    params.set('date_to', dateTo);
  }
  studentIds.forEach((studentId) => {
    params.append('student_ids', String(studentId));
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/reports/events/${eventId}/spravki.zip${suffix}`);
  if (!response.ok) {
    let message = 'Не удалось сформировать архив справок.';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Keep fallback message for non-JSON errors.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const rawName = utfMatch?.[1] || plainMatch?.[1] || 'Справки.zip';
  const filename = decodeURIComponent(rawName);

  return { blob, filename };
}

async function downloadFile(path, fallbackFilename) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    let message = 'Не удалось сформировать файл.';
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Keep fallback message for non-JSON errors.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const rawName = utfMatch?.[1] || plainMatch?.[1] || fallbackFilename;
  const filename = decodeURIComponent(rawName);

  return { blob, filename };
}

export async function downloadEmploymentDocumentsArchive({ studentIds = [], file = '' } = {}) {
  const params = new URLSearchParams();
  studentIds.forEach((studentId) => {
    params.append('student_ids', String(studentId));
  });
  if (file) {
    params.set('file', file);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return downloadFile(`/reports/employment/documents.zip${suffix}`, 'Документы_на_трудоустройство.zip');
}

export async function downloadEmploymentBankDetailsExcel({ studentIds = [] } = {}) {
  const params = new URLSearchParams();
  studentIds.forEach((studentId) => {
    params.append('student_ids', String(studentId));
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return downloadFile(`/reports/employment/bank-details.zip${suffix}`, 'Банковские_реквизиты_ГПХ.zip');
}

export { API_BASE_URL };


