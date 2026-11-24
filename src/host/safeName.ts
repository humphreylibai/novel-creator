/** 只允许可作为单层文件名的值：非空、非 . / ..、不含 / \ NUL。 */
export function isSafeName(value: string): boolean {
  return value.length > 0 && value !== '.' && value !== '..' && !/[/\\\0]/.test(value);
}
