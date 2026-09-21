// Đổi lỗi kỹ thuật thành câu dễ hiểu cho người dùng cuối (bảo vệ, CVDV).
// Lỗi mạng / Supabase bị pause thường có dạng "Failed to fetch", "NetworkError", "timeout"...
export function friendlyError(message: string): string {
  if (/fetch|network|timeout|timed out|abort|ENOTFOUND/i.test(message)) {
    return "Không kết nối được máy chủ dữ liệu. Kiểm tra mạng, hoặc thử lại sau vài phút. Nếu vẫn lỗi hãy báo Admin.";
  }
  return message;
}
