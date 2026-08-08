export function valuesToFormData(values: Record<string, string | undefined>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      formData.set(key, value);
    }
  }

  return formData;
}
