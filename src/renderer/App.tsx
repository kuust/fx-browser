import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types';
import './styles/app.css';

type SectionId = 'environments' | 'import' | 'proxy' | 'cookies' | 'settings';

type FilterStatus = 'all' | 'running' | 'stopped' | 'cookie-pending';

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
  if (env.cookieImportStatus === 'pending') return '待导入';
  if (env.cookieImportStatus === 'failed') return '失败';
  return '无 Cookie';
}

function loginCookieSummary(env: EnvironmentListItem) {
  const raw = env.cookieRaw.toLowerCase();
  const xReady = raw.includes('"auth_token"') && raw.includes('"ct0"') && (raw.includes('x.com') || raw.includes('twitter.com'));
  const googleReady = raw.includes('google.com') || raw.includes('mail.google.com');
  const discordReady = raw.includes('discord.com') && raw.includes('"token"');
  return { xReady, googleReady, discordReady };
}

function statusClass(env: EnvironmentListItem) {
  if (env.status === 'running') return 'pill success';
  if (env.cookieImportStatus === 'failed') return 'pill danger';
  if (env.cookieImportStatus === 'pending') return 'pill warning';
  return 'pill';
}

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('environments');
  const [environments, setEnvironments] = useState<EnvironmentListItem[]>([]);
  const [summary, setSummary] = useState<SavedImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [proxyResults, setProxyResults] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('等待导入 MoreLogin TXT');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

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

  const filteredEnvironments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return environments.filter((env) => {
      const matchKeyword = !keyword || [env.profileName, env.loginAccount, env.profileGroup, env.profileTag, env.proxyHost, env.profileNote]
        .some((value) => value.toLowerCase().includes(keyword));
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'running' && env.status === 'running')
        || (statusFilter === 'stopped' && env.status !== 'running')
        || (statusFilter === 'cookie-pending' && env.cookieImportStatus !== 'imported' && env.cookieCount > 0);
      return matchKeyword && matchStatus;
    });
  }, [environments, query, statusFilter]);

  const runningCount = environments.filter((env) => env.status === 'running').length;
  const xReadyCount = environments.filter((env) => loginCookieSummary(env).xReady).length;
  const navClass = (section: SectionId) => (activeSection === section ? 'active' : undefined);
  const proxyPendingCount = environments.filter((env) => env.proxyRaw && !proxyResults[env.environmentId]).length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FX</div>
          <div>
            <strong>FX Browser</strong>
            <span>富信指纹环境管理器</span>
          </div>
        </div>
        <nav>
          <button className={navClass('environments')} onClick={() => setActiveSection('environments')}><span className="nav-icon">▦</span><span>环境管理</span><em>{environments.length}</em></button>
          <button className={navClass('import')} onClick={() => setActiveSection('import')}><span className="nav-icon">⇪</span><span>MoreLogin 导入</span></button>
          <button className={navClass('proxy')} onClick={() => setActiveSection('proxy')}><span className="nav-icon">◎</span><span>代理检测</span><em>{proxyPendingCount}</em></button>
          <button className={navClass('cookies')} onClick={() => setActiveSection('cookies')}><span className="nav-icon">◒</span><span>Cookie 状态</span><em>{xReadyCount}</em></button>
          <button className={navClass('settings')} onClick={() => setActiveSection('settings')}><span className="nav-icon">⚙</span><span>设置</span></button>
        </nav>
        <div className="sidebar-footer">
          <span>Local Edition</span>
          <strong>Fingerprint Chromium 148</strong>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="headline">
            <div className="eyebrow"><span className="live-dot" /> 本地指纹环境控制台</div>
            <h1>环境管理</h1>
            <p>{message}</p>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => void refresh()} disabled={loading}>刷新</button>
            <button className="ghost" onClick={() => setActiveSection('proxy')} disabled={loading}>批量检测</button>
            <button className="primary" onClick={handleImport} disabled={loading}>
              {loading ? '处理中...' : '+ 导入 MoreLogin TXT'}
            </button>
          </div>
        </header>

        <section className="cards">
          <article className="card accent">
            <div className="card-label">Total environments</div>
            <p className="metric">{environments.length}</p>
            <small>按 MoreLogin 导出顺序保留</small>
          </article>
          <article className="card">
            <div className="card-label">Running</div>
            <p className="metric small">{runningCount}</p>
            <small>当前已启动环境</small>
          </article>
          <article className="card">
            <div className="card-label">X/Twitter Cookie</div>
            <p className="metric small">{xReadyCount}</p>
            <small>含 auth_token / ct0</small>
          </article>
          <article className="card">
            <div className="card-label">Proxy / Groups</div>
            <p className="metric small">{summary?.proxyParseSuccess ?? 0}<span> / {groupedCount}</span></p>
            <small>已解析代理 / 分组数</small>
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

        {activeSection === 'cookies' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>Cookie 状态</h2><span>X 可尝试恢复：{xReadyCount}</span></div>
            <div className="panel-body">
              <p>这里按环境 Cookie 原文判断登录线索：Google、X/Twitter、Discord。X 需要 auth_token + ct0；Discord 当前 TXT 大多只有风控 Cookie。</p>
            </div>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="panel info-panel">
            <div className="panel-title"><h2>设置</h2><span>运行参数</span></div>
            <div className="panel-body">
              <p>设置入口已可点击。当前版本优先使用内置/配置的 fingerprint Chromium 内核，找不到时回退系统 Chrome/Edge；代理默认走本地桥接 → Clash → 环境代理。</p>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="panel-title table-title">
            <div>
              <h2>我的环境</h2>
              <span>{summary ? `来源：${summary.sourceFileName}` : '未导入'} · 显示 {filteredEnvironments.length}/{environments.length}</span>
            </div>
            <div className="filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索邮箱、分组、代理、备注" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}>
                <option value="all">全部状态</option>
                <option value="running">运行中</option>
                <option value="stopped">未启动</option>
                <option value="cookie-pending">待导 Cookie</option>
              </select>
            </div>
          </div>
          <div className="table">
            <div className="row header">
              <span>序号</span><span>环境 / 账号</span><span>分组</span><span>代理出口</span><span>Cookie 登录线索</span><span>内核/UA</span><span>状态</span><span>操作</span>
            </div>
            {environments.length === 0 ? (
              <div className="row empty seven"><span>—</span><span>导入 MoreLogin TXT 后显示</span><span>—</span><span>—</span><span>—</span><span>—</span><span>未启动</span><span>—</span></div>
            ) : filteredEnvironments.length === 0 ? (
              <div className="row empty seven"><span>—</span><span>没有符合筛选的环境</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
            ) : filteredEnvironments.map((env) => {
              const loginSummary = loginCookieSummary(env);
              return (
                <div className="row seven" key={env.environmentId}>
                  <span className="mono muted">#{env.importOrder}</span>
                  <span className="env-cell" title={env.profileName}>
                    <strong>{maskEmail(env.profileName)}</strong>
                    <small>{env.loginAccount ? maskEmail(env.loginAccount) : env.environmentId} · ID {env.sourceProfileId || env.environmentId}</small>
                  </span>
                  <span><span className="tag">{env.profileGroup || '未分组'}</span></span>
                  <span className="proxy-cell" title={env.proxyRaw}>
                    <strong>{env.proxyHost ? `${env.proxyHost}:${env.proxyPort ?? ''}` : '无代理'}</strong>
                    <small>{proxyResults[env.environmentId] ?? '未检测'}</small>
                  </span>
                  <span className="cookie-cell">
                    <strong>{env.cookieCount} cookies · {cookieStatusText(env)}</strong>
                    <span className="badge-row">
                      <b className={loginSummary.xReady ? 'mini-badge ok' : 'mini-badge'}>X</b>
                      <b className={loginSummary.googleReady ? 'mini-badge ok' : 'mini-badge'}>Google</b>
                      <b className={loginSummary.discordReady ? 'mini-badge ok' : 'mini-badge'}>Discord</b>
                    </span>
                  </span>
                  <span className="kernel-cell"><strong>Chromium 148</strong><small>UA Chrome {chromeVersion(env.userAgent)}</small></span>
                  <span><span className={statusClass(env)}>{env.status === 'running' ? '运行中' : cookieStatusText(env)}</span></span>
                  <span className="actions">
                    <button className="ghost compact" onClick={() => void handleCheckProxy(env.environmentId)} disabled={loading}>检测</button>
                    <button className="ghost compact" onClick={() => void handleResetCookieImport(env.environmentId)} disabled={loading || env.cookieCount === 0}>重导</button>
                    {env.status === 'running' ? (
                      <button className="secondary compact" onClick={() => void handleStop(env.environmentId)} disabled={loading}>停止</button>
                    ) : (
                      <button className="primary compact" onClick={() => void handleStart(env.environmentId)} disabled={loading}>打开</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
