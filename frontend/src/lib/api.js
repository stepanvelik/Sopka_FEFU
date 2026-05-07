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

export { API_BASE_URL };
