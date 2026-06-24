import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types';
import './styles/app.css';

type SectionId = 'environments' | 'import' | 'proxy' | 'sync' | 'settings';

function maskEmail(value: string) {
  if (!value.includes('@')) return value || '—';
  const [name, domain] = value.split('@');
  return `${name.slice(0, 3)}***@${domain}`;
}

function chromeVersion(ua: string) {
  return ua.match(/Chrome\/(\d+)/)?.[1] ?? '—';
}

function cookieStatusText(env: EnvironmentListItem) {
  if (env.cookieImportStatus === 'imported') return '已导入';
  if (env.cookieImportStatus === 'pending') return '待首次导入';
  if (env.cookieImportStatus === 'failed') return `失败 ${env.cookieImportError || ''}`;
  return '无 Cookie';
}

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('environments');
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
    setActiveSection('import');
    setMessage('请选择 MoreLogin 导出的 export_profile.txt');
    try {
      const result = await window.fxBrowser.importMoreLoginFile();
      if (result.canceled) {
        setMessage('已取消导入');
        return;
      }
      setSummary(result.summary);
      setEnvironments(result.environments);
      setActiveSection('environments');
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
    setActiveSection('proxy');
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

  async function handleResetCookieImport(environmentId: string) {
    setLoading(true);
    try {
      const result = await window.fxBrowser.resetCookieImport(environmentId);
      setEnvironments(result.environments);
      setMessage(`已将 ${environmentId} 的 Cookie 状态重置为待导入，下次启动会重新注入一次`);
    } catch (error) {
      setMessage(`重置 Cookie 状态失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const groupedCount = useMemo(() => {
    const groups = new Set(environments.map((item) => item.profileGroup || '未分组'));
    return groups.size;
  }, [environments]);

  const navClass = (section: SectionId) => (activeSection === section ? 'active' : undefined);
  const proxyPendingCount = environments.filter((env) => env.proxyRaw && !proxyResults[env.environmentId]).length;

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
          <button className={navClass('environments')} onClick={() => setActiveSection('environments')}>环境管理</button>
          <button className={navClass('import')} onClick={() => setActiveSection('import')}>MoreLogin 导入</button>
          <button className={navClass('proxy')} onClick={() => setActiveSection('proxy')}>代理检测</button>
          <button className={navClass('sync')} onClick={() => setActiveSection('sync')}>同步器</button>
          <button className={navClass('settings')} onClick={() => setActiveSection('settings')}>设置</button>
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

        {activeSection === 'import' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>MoreLogin 导入</h2><span>{summary ? `上次来源：${summary.sourceFileName}` : '未导入'}</span></div>
            <div className="panel-body">
              <p>点击“导入 MoreLogin TXT”选择 MoreLogin 导出的 export_profile.txt。导入会保留原始顺序、原始 Profile ID、Cookie、代理、UA、分组、标签和备注。</p>
              <button className="primary" onClick={handleImport} disabled={loading}>{loading ? '导入中...' : '选择并导入 TXT'}</button>
            </div>
          </section>
        )}

        {activeSection === 'proxy' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>代理检测</h2><span>待检测：{proxyPendingCount}</span></div>
            <div className="panel-body">
              <p>在环境列表每行点击“检测”即可检测该环境的代理出口 IP。检测结果会显示在代理列下方。</p>
            </div>
          </section>
        )}

        {activeSection === 'sync' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>同步器</h2><span>本地个人版</span></div>
            <div className="panel-body">
              <p>同步器入口已可点击。当前版本以本机数据为准，后续可在这里加入备份、恢复和跨设备同步配置。</p>
            </div>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>设置</h2><span>运行参数</span></div>
            <div className="panel-body">
              <p>设置入口已可点击。当前版本默认保留 MoreLogin 原始 UA，并使用本机默认 Chromium/Chrome 启动环境。</p>
            </div>
          </section>
        )}

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
                <span>{env.cookieCount}<br /><small>{cookieStatusText(env)}</small></span>
                <span>Chrome {chromeVersion(env.userAgent)}</span>
                <span className="status">{env.status === 'running' ? '运行中' : '未启动'}</span>
                <span className="actions">
                  <button className="secondary" onClick={() => void handleCheckProxy(env.environmentId)} disabled={loading}>检测</button>
                  <button className="secondary" onClick={() => void handleResetCookieImport(env.environmentId)} disabled={loading || env.cookieCount === 0}>重导Cookie</button>
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
