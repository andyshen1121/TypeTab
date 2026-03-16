/**
 * Tab 搜索/过滤算法
 * 纯函数实现，可被 Service Worker (module worker)、Content Script、Popup 使用
 */

/**
 * 搜索 Tab 列表
 * @param {Array} tabs - chrome.tabs.query 返回的 Tab 对象数组
 * @param {string} query - 用户输入的搜索关键词
 * @param {number} [maxResults=20] - 最大返回条数
 * @returns {Array} 匹配的 Tab 列表，按相关度排序
 */
export function searchTabs(tabs, query, maxResults = 20) {
  if (!query || !query.trim()) {
    return tabs.slice(0, maxResults);
  }

  const keywords = query.toLowerCase().trim().split(/\s+/);

  const scored = [];
  for (const tab of tabs) {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();

    // 所有关键词都必须命中（AND 逻辑）
    let allMatch = true;
    let totalScore = 0;

    for (const keyword of keywords) {
      const titleIndex = title.indexOf(keyword);
      const urlIndex = url.indexOf(keyword);

      if (titleIndex === -1 && urlIndex === -1) {
        allMatch = false;
        break;
      }

      // 标题匹配优先于 URL 匹配
      // 匹配位置越靠前分数越高
      if (titleIndex !== -1) {
        totalScore += 100 - Math.min(titleIndex, 50) - Math.min(title.length, 50);
      } else {
        totalScore += 50 - Math.min(urlIndex, 50);
      }
    }

    if (allMatch) {
      scored.push({ tab, score: totalScore });
    }
  }

  // 按分数降序排序
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map((item) => item.tab);
}

/**
 * 标准化 URL，去掉 hash 和尾部斜杠
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.split('#')[0];
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * 判断两个 URL 是否属于同一域名
 * @param {string} url1
 * @param {string} url2
 * @returns {boolean}
 */
export function matchesDomain(url1, url2) {
  try {
    const host1 = new URL(url1).hostname;
    const host2 = new URL(url2).hostname;
    return host1 === host2;
  } catch {
    return false;
  }
}

/**
 * 判断两个 URL 是否重复（根据匹配规则）
 * @param {string} url1
 * @param {string} url2
 * @param {'exact_url'|'domain'} matchRule
 * @returns {boolean}
 */
export function isDuplicate(url1, url2, matchRule) {
  if (!url1 || !url2) return false;
  if (matchRule === 'domain') {
    return matchesDomain(url1, url2);
  }
  return normalizeUrl(url1) === normalizeUrl(url2);
}
