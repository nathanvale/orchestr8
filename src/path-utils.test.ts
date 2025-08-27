import { describe, expect, test } from 'vitest';
import {
  pathSeparator,
  joinPath,
  normalizePath,
  dirname,
  basename,
  isAbsolute,
  toPosixPath,
  toPlatformPath,
} from './path-utils';

// eslint-disable-next-line max-lines-per-function
describe('cross-platform path utilities', () => {
  describe('pathSeparator', () => {
    test('uses forward slash on Unix-like systems', () => {
      // On non-Windows systems, should be forward slash
      if (typeof process === 'undefined' || process.platform !== 'win32') {
        expect(pathSeparator).toBe('/');
      }
    });
    
    test('uses backslash on Windows', () => {
      // This test only makes sense when actually running on Windows
      if (typeof process !== 'undefined' && process.platform === 'win32') {
        expect(pathSeparator).toBe('\\');
      }
    });
  });
  
  describe('joinPath', () => {
    test('joins path segments with platform separator', () => {
      const result = joinPath('folder', 'subfolder', 'file.txt');
      expect(result).toContain('folder');
      expect(result).toContain('subfolder');
      expect(result).toContain('file.txt');
    });
    
    test('filters out empty segments', () => {
      const result = joinPath('folder', '', 'file.txt');
      expect(result).toBe(`folder${pathSeparator}file.txt`);
    });
    
    test('returns empty string for no segments', () => {
      expect(joinPath()).toBe('');
      expect(joinPath('', '')).toBe('');
    });
    
    test('handles paths with mixed separators', () => {
      const result = joinPath('folder/sub', 'another\\path', 'file.txt');
      const segments = result.split(pathSeparator);
      expect(segments).toContain('folder');
      expect(segments).toContain('sub');
      expect(segments).toContain('another');
      expect(segments).toContain('path');
      expect(segments).toContain('file.txt');
    });
    
    test('removes duplicate separators', () => {
      const result = joinPath('folder//sub', 'file.txt');
      expect(result).not.toContain(`${pathSeparator}${pathSeparator}`);
    });
  });
  
  describe('normalizePath', () => {
    const pathParts = ['folder', 'sub', 'file.txt'];
    
    test('normalizes mixed separators to platform separator', () => {
      const result = normalizePath('folder/sub\\file.txt');
      expect(result.split(pathSeparator)).toEqual(pathParts);
    });
    
    test('removes trailing separator except for root', () => {
      const subPath = `folder${pathSeparator}sub`;
      expect(normalizePath('folder/sub/')).toBe(subPath);
      expect(normalizePath('/')).toBe('/');
    });
    
    test('handles empty string', () => {
      expect(normalizePath('')).toBe('');
    });
    
    test('collapses multiple separators', () => {
      const result = normalizePath('folder//sub///file.txt');
      expect(result).not.toContain(`${pathSeparator}${pathSeparator}`);
    });
  });
  
  describe('dirname', () => {
    test('returns directory portion of path', () => {
      const result = dirname(`folder${pathSeparator}sub${pathSeparator}file.txt`);
      expect(result).toBe(`folder${pathSeparator}sub`);
    });
    
    test('returns dot for filename without directory', () => {
      expect(dirname('file.txt')).toBe('.');
    });
    
    test('returns dot for empty string', () => {
      expect(dirname('')).toBe('.');
    });
    
    test('handles root directory', () => {
      expect(dirname('/file.txt')).toBe('/');
      expect(dirname('/')).toBe('/');
    });
    
    test('handles nested directories', () => {
      const result = dirname(`a${pathSeparator}b${pathSeparator}c${pathSeparator}d.txt`);
      expect(result).toBe(`a${pathSeparator}b${pathSeparator}c`);
    });
  });
  
  describe('basename', () => {
    test('returns filename from path', () => {
      expect(basename(`folder${pathSeparator}file.txt`)).toBe('file.txt');
    });
    
    test('returns the full string if no separator', () => {
      expect(basename('file.txt')).toBe('file.txt');
    });
    
    test('returns empty string for empty input', () => {
      expect(basename('')).toBe('');
    });
    
    test('handles directories', () => {
      const subfolder = 'subfolder';
      expect(basename(`folder${pathSeparator}${subfolder}${pathSeparator}`)).toBe(subfolder);
      expect(basename(`folder${pathSeparator}${subfolder}`)).toBe(subfolder);
    });
  });
  
  describe('isAbsolute', () => {
    test('identifies Unix absolute paths', () => {
      expect(isAbsolute('/home/user')).toBe(true);
      expect(isAbsolute('/file.txt')).toBe(true);
    });
    
    test('identifies relative paths', () => {
      expect(isAbsolute('relative/path')).toBe(false);
      expect(isAbsolute('./file.txt')).toBe(false);
      expect(isAbsolute('../parent')).toBe(false);
    });
    
    test('returns false for empty string', () => {
      expect(isAbsolute('')).toBe(false);
    });
    
    test('handles Windows-style paths', () => {
      // These should only be considered absolute on Windows
      const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
      
      if (isWindows) {
        expect(isAbsolute('C:\\Users')).toBe(true);
        expect(isAbsolute('D:\\')).toBe(true);
        expect(isAbsolute('\\\\server\\share')).toBe(true);
      } else {
        // On Unix, these are not absolute paths
        expect(isAbsolute('C:\\Users')).toBe(false);
      }
    });
  });
  
  describe('toPosixPath', () => {
    test('converts backslashes to forward slashes', () => {
      const posixPath = 'folder/sub/file.txt';
      expect(toPosixPath('folder\\sub\\file.txt')).toBe(posixPath);
    });
    
    test('preserves existing forward slashes', () => {
      const posixPath = 'folder/sub/file.txt';
      expect(toPosixPath(posixPath)).toBe(posixPath);
    });
    
    test('handles mixed separators', () => {
      const posixPath = 'folder/sub/file.txt';
      expect(toPosixPath('folder\\sub/file.txt')).toBe(posixPath);
    });
    
    test('returns empty string for empty input', () => {
      expect(toPosixPath('')).toBe('');
    });
  });
  
  describe('toPlatformPath', () => {
    test('converts to platform-specific separators', () => {
      const input = 'folder/sub\\file.txt';
      const result = toPlatformPath(input);
      
      // Should use consistent separators for the platform
      const separators = result.match(/[/\\]/g) ?? [];
      const uniqueSeparators = [...new Set(separators)];
      expect(uniqueSeparators).toHaveLength(separators.length > 0 ? 1 : 0);
    });
    
    test('is equivalent to normalizePath', () => {
      const testPaths = [
        'folder/sub/file.txt',
        'folder\\sub\\file.txt',
        'folder/sub\\file.txt',
        '/absolute/path',
        '',
      ];
      
      for (const path of testPaths) {
        expect(toPlatformPath(path)).toBe(normalizePath(path));
      }
    });
  });
  
  describe('edge cases', () => {
    test('handles paths with special characters', () => {
      const special = 'folder with spaces/sub-folder/file.name.txt';
      expect(() => normalizePath(special)).not.toThrow();
      expect(() => basename(special)).not.toThrow();
      expect(() => dirname(special)).not.toThrow();
    });
    
    test('handles unicode in paths', () => {
      const unicode = 'フォルダ/サブフォルダ/ファイル.txt';
      expect(() => joinPath('parent', unicode)).not.toThrow();
      expect(basename(unicode)).toBe('ファイル.txt');
    });
    
    test('handles dots in paths', () => {
      expect(normalizePath('./folder/../file.txt')).toContain('.');
      expect(basename('file.name.with.dots.txt')).toBe('file.name.with.dots.txt');
    });
  });
});