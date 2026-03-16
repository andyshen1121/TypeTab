import { describe, test, expect } from 'bun:test';
import { searchTabs, normalizeUrl, matchesDomain, isDuplicate } from './search.js';

// 模拟 Tab 数据
const mockTabs = [
  { id: 1, title: 'GitHub - Dashboard', url: 'https://github.com/dashboard', favIconUrl: 'https://github.com/favicon.ico' },
  { id: 2, title: 'Google Docs - 项目文档', url: 'https://docs.google.com/document/d/123', favIconUrl: '' },
  { id: 3, title: 'Stack Overflow - JavaScript', url: 'https://stackoverflow.com/questions/123', favIconUrl: '' },
  { id: 4, title: 'GitHub - Pull Requests', url: 'https://github.com/pulls', favIconUrl: '' },
  { id: 5, title: 'TypeTab Options', url: 'chrome-extension://abc/options/options.html', favIconUrl: '' },
];

describe('searchTabs', () => {
  test('空关键词返回所有 Tab', () => {
    const results = searchTabs(mockTabs, '');
    expect(results).toHaveLength(5);
  });

  test('按标题子串匹配', () => {
    const results = searchTabs(mockTabs, 'github');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1);
    expect(results[1].id).toBe(4);
  });

  test('按 URL 子串匹配', () => {
    const results = searchTabs(mockTabs, 'stackoverflow');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  test('不区分大小写', () => {
    const results = searchTabs(mockTabs, 'GITHUB');
    expect(results).toHaveLength(2);
  });

  test('多词搜索 AND 逻辑', () => {
    const results = searchTabs(mockTabs, 'github pull');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(4);
  });

  test('无匹配返回空数组', () => {
    const results = searchTabs(mockTabs, 'nonexistent');
    expect(results).toHaveLength(0);
  });

  test('匹配位置靠前的排序更高', () => {
    const tabs = [
      { id: 1, title: 'ABC test page', url: 'https://example.com', favIconUrl: '' },
      { id: 2, title: 'test page ABC', url: 'https://example.com', favIconUrl: '' },
    ];
    const results = searchTabs(tabs, 'test');
    expect(results[0].id).toBe(2);
  });

  test('最多返回 20 条结果', () => {
    const manyTabs = Array.from({ length: 30 }, (_, i) => ({
      id: i, title: `Tab ${i}`, url: `https://example.com/${i}`, favIconUrl: ''
    }));
    const results = searchTabs(manyTabs, 'tab');
    expect(results).toHaveLength(20);
  });
});

describe('normalizeUrl', () => {
  test('去掉 hash 部分', () => {
    expect(normalizeUrl('https://foo.com/page#section1')).toBe('https://foo.com/page');
  });

  test('没有 hash 的 URL 保持不变', () => {
    expect(normalizeUrl('https://foo.com/page')).toBe('https://foo.com/page');
  });

  test('去掉尾部斜杠', () => {
    expect(normalizeUrl('https://foo.com/')).toBe('https://foo.com');
  });
});

describe('matchesDomain', () => {
  test('相同域名返回 true', () => {
    expect(matchesDomain('https://github.com/foo', 'https://github.com/bar')).toBe(true);
  });

  test('不同域名返回 false', () => {
    expect(matchesDomain('https://github.com/foo', 'https://google.com/bar')).toBe(false);
  });

  test('子域名视为不同', () => {
    expect(matchesDomain('https://docs.google.com', 'https://mail.google.com')).toBe(false);
  });
});

describe('isDuplicate', () => {
  test('exact_url 模式：相同 URL 返回 true', () => {
    expect(isDuplicate('https://foo.com/page', 'https://foo.com/page', 'exact_url')).toBe(true);
  });

  test('exact_url 模式：不同 hash 视为相同', () => {
    expect(isDuplicate('https://foo.com/page#a', 'https://foo.com/page#b', 'exact_url')).toBe(true);
  });

  test('exact_url 模式：不同路径返回 false', () => {
    expect(isDuplicate('https://foo.com/a', 'https://foo.com/b', 'exact_url')).toBe(false);
  });

  test('domain 模式：相同域名返回 true', () => {
    expect(isDuplicate('https://foo.com/a', 'https://foo.com/b', 'domain')).toBe(true);
  });

  test('domain 模式：不同域名返回 false', () => {
    expect(isDuplicate('https://foo.com/a', 'https://bar.com/b', 'domain')).toBe(false);
  });

  test('空 URL 返回 false', () => {
    expect(isDuplicate('', 'https://foo.com', 'exact_url')).toBe(false);
  });
});
