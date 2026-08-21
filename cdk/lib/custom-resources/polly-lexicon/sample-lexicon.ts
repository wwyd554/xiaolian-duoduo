import * as fs from 'fs';
import * as path from 'path';

/**
 * 許可されたレキシコンファイルのマップ
 */
const ALLOWED_LEXICONS: Record<string, string> = {
  'ja-JP.xml': 'ja-JP.xml',
  'en-US.xml': 'en-US.xml'
};

/**
 * Lexiconファイルを読み込む
 * @param filename レキシコンファイル名
 * @returns レキシコンの内容
 */
export function loadLexicon(filename: string): string {
  try {
    // 許可されたファイル名のホワイトリストチェック
    const safeFilename = ALLOWED_LEXICONS[filename];
    if (!safeFilename) {
      throw new Error('不允许的文件名');
    }

    // 固定パスを使用（パストラバーサル攻撃を防ぐ）
    const lexiconsDir = path.resolve(__dirname, 'lexicons');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const lexiconPath = path.resolve(lexiconsDir, safeFilename);

    // パスが期待されるディレクトリ内にあることを確認
    if (!lexiconPath.startsWith(lexiconsDir)) {
      throw new Error('无效的文件路径');
    }

    return fs.readFileSync(lexiconPath, 'utf8');
  } catch (error) {
    console.error('Lexiconファイルの読み込みに失敗:', { filename }, error);
    throw error;
  }
}

/**
 * 日本語レキシコンを読み込む
 */
export const sampleJapaneseLexicon = loadLexicon('ja-JP.xml');

/**
 * 英語レキシコンを読み込む
 */
export const sampleEnglishLexicon = loadLexicon('en-US.xml');