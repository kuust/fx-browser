import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types';
import './styles/app.css';

function maskEmail(value: string) {
  if (!value.includes('@')) return value || '—';
  const [name, domain] = value.split('@');
  return `${name.slice(0, 3)}***@${domain}`;
}

function chromeVersion(ua: string) {
  return ua.match(/Chrome\/(\d+)/)?.[1] ?? '—';
}

function App() {
  const [environments, setEnvironments] = useState<EnvironmentListItem[]>([]);
  const [summary, setSummary] = useState<SavedImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [proxyResults, setProxyResults] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('等待导入 MoreLogin TXT');

  async function refresh() {
    const [list, lastSummary] = await Promise.all([
      window.fxBrowser.listEnvironments(),
      window.fxBrowser.getLastImportSummary(),
    ]);
    setEnvironments(list);
    setSummary(lastSummary);
    if (list.length > 0) setMessage(`已加载 ${list.length} 个环境，默认按 MoreLogin 导出顺序排列`);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleImport() {
    setLoading(true);
    setMessage('请选择 MoreLogin 导出的 export_profile.txt');
    try {
      const result = await window.fxBrowser.importMoreLoginFile();
      if (result.canceled) {
        setMessage('已取消导入');
        return;
      }
      setSummary(result.summary);
      setEnvironments(result.environments);
      setMessage(`导入完成：${result.summary.totalProfiles} 个环境，已严格保留原始顺序`);
    } catch (error) {
      setMessage(`导入失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(environmentId: string) {
    setLoading(true);
    try {
      const result = await window.fxBrowser.startEnvironment(environmentId);
      setEnvironments(result.environments);
      setMessage(result.status === 'already-running' ? `环境 ${environmentId} 已在运行` : `已启动环境 ${environmentId}`);
    } catch (error) {
      setMessage(`启动失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop(environmentId: string) {
    setLoading(true);
    try {
      const result = await window.fxBrowser.stopEnvironment(environmentId);
      setEnvironments(result.environments);
      setMessage(result.status === 'not-running' ? `环境 ${environmentId} 未在运行` : `已停止环境 ${environmentId}`);
    } catch (error) {
      setMessage(`停止失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckProxy(environmentId: string) {
    setLoading(true);
    setProxyResults((prev) => ({ ...prev, [environmentId]: '检测中...' }));
    try {
      const result = await window.fxBrowser.checkProxy(environmentId);
      const text = result.status === 'ok'
        ? `成功 ${result.ip ?? ''}`
        : result.status === 'skipped'
          ? '无代理'
          : `失败 ${result.message}`;
      setProxyResults((prev) => ({ ...prev, [environmentId]: text }));
      setMessage(`代理检测：${environmentId} ${text}`);
    } catch (error) {
      const text = `失败 ${(error as Error).message}`;
      setProxyResults((prev) => ({ ...prev, [environmentId]: text }));
      setMessage(`代理检测失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const groupedCount = useMemo(() => {
    const groups = new Set(environments.map((item) => item.profileGroup || '未分组'));
    return groups.size;
  }, [environments]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/logo/fuxin-logo.png" alt="FX Browser logo" />
          <div>
            <strong>FX Browser</strong>
            <span>富信指纹环境管理器</span>
          </div>
        </div>
        <nav>
          <a className="active">环境管理</a>
          <a>MoreLogin 导入</a>
          <a>代理检测</a>
          <a>同步器</a>
          <a>设置</a>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>FX Browser V0.1</h1>
            <p>{message}</p>
          </div>
          <button className="primary" onClick={handleImport} disabled={loading}>
            {loading ? '导入中...' : '导入 MoreLogin TXT'}
          </button>
        </header>

        <section className="cards">
          <article className="card accent">
            <h2>环境数量</h2>
            <p className="metric">{environments.length}</p>
          </article>
          <article className="card">
            <h2>代理统计</h2>
            <p>成功解析：{summary?.proxyParseSuccess ?? 0}；空代理：{summary?.proxyEmpty ?? 0}</p>
          </article>
          <article className="card">
            <h2>Cookie 统计</h2>
            <p>成功解析：{summary?.cookieParseSuccess ?? 0}；失败：{summary?.cookieParseFailed ?? 0}</p>
          </article>
          <article className="card">
            <h2>分组数量</h2>
            <p className="metric small">{groupedCount}</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>环境列表</h2>
            <span>{summary ? `来源：${summary.sourceFileName}` : '未导入'}</span>
          </div>
          <div className="table">
            <div className="row header">
              <span>序号</span><span>环境名称</span><span>分组</span><span>代理</span><span>Cookie</span><span>UA</span><span>状态</span><span>操作</span>
            </div>
            {environments.length === 0 ? (
              <div className="row empty seven"><span>—</span><span>导入 MoreLogin TXT 后显示</span><span>—</span><span>—</span><span>—</span><span>—</span><span>未启动</span><span>—</span></div>
            ) : environments.map((env) => (
              <div className="row seven" key={env.environmentId}>
                <span>#{env.importOrder}</span>
                <span title={env.profileName}>{maskEmail(env.profileName)}</span>
                <span>{env.profileGroup || '未分组'}</span>
                <span title={env.proxyRaw}>{env.proxyHost ? `${env.proxyHost}:${env.proxyPort ?? ''}` : '无代理'}<br /><small>{proxyResults[env.environmentId] ?? '未检测'}</small></span>
                <span>{env.cookieCount}</span>
                <span>Chrome {chromeVersion(env.userAgent)}</span>
                <span className="status">{env.status === 'running' ? '运行中' : '未启动'}</span>
                <span className="actions">
                  <button className="secondary" onClick={() => void handleCheckProxy(env.environmentId)} disabled={loading}>检测</button>
                  {env.status === 'running' ? (
                    <button className="secondary" onClick={() => void handleStop(env.environmentId)} disabled={loading}>停止</button>
                  ) : (
                    <button className="secondary" onClick={() => void handleStart(env.environmentId)} disabled={loading}>启动</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
