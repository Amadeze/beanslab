// User-friendly error messages for desktop app

export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PAIRING_CODE: "Kode pairing tidak valid. Periksa kembali kode 6 digit Anda.",
  PAIRING_CODE_USED: "Kode pairing sudah digunakan. Minta kode baru dari dashboard.",
  PAIRING_CODE_EXPIRED: "Kode pairing sudah kedaluwarsa. Minta kode baru dari dashboard.",
  INSTALLATION_ALREADY_PAIRED: "Instalasi ini sudah terpasang. Putuskan dari dashboard jika ingin pasang ulang.",
  UNAUTHORIZED: "Autentikasi gagal. Silakan pasang ulang (pairing ulang).",
  AUTH_REQUIRED: "Sesi login expired. Silakan login ulang di browser lalu coba lagi.",
  CONNECTOR_NOT_FOUND: "Connector tidak ditemukan. Silakan pasang ulang (pairing ulang).",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
  INVALID_REQUEST: "Data tidak valid. Silakan coba lagi.",
  FILE_TOO_LARGE: "File terlalu besar. Maksimal 10MB.",
  INVALID_FILE: "File tidak valid. Hanya file .alog yang diizinkan.",
  HASH_MISMATCH: "File rusak atau berubah saat upload. Mencoba ulang...",
  NETWORK_ERROR: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
  TIMEOUT: "Server tidak merespon. Periksa koneksi internet Anda.",
  SERVER_ERROR: "Server mengalami gangguan. Coba lagi nanti.",
  PARSE_ERROR: "Respons server tidak valid. Coba lagi nanti.",
  FOLDER_NOT_FOUND: "Folder Artisan tidak ditemukan. Pilih folder yang benar.",
  FOLDER_UNAVAILABLE: "Folder Artisan tidak tersedia. Pastikan folder masih ada.",
};

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Terjadi kesalahan yang tidak diketahui.";
}
