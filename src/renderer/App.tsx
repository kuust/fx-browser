import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

function App() {
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
            <h1>FX Browser</h1>
            <p>Windows 个人版浏览器环境管理器，优先支持 MoreLogin 环境迁移。</p>
          </div>
          <button className="primary">导入 MoreLogin TXT</button>
        </header>

        <section className="cards">
          <article className="card accent">
            <h2>V0.1 目标</h2>
            <p>严格导入 MoreLogin 导出的环境顺序、Cookie、代理、UA、账号、分组和标签。</p>
          </article>
          <article className="card">
            <h2>数据安全</h2>
            <p>真实 export_profile.txt、Cookie、数据库、代理密码和账号密码均被 .gitignore 排除，禁止提交到 GitHub。</p>
          </article>
          <article className="card">
            <h2>Windows EXE</h2>
            <p>仓库内置 GitHub Actions，后续 push 到 main 后可自动构建 Windows 安装包。</p>
          </article>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>环境列表预览</h2>
            <span>等待导入</span>
          </div>
          <div className="table">
            <div className="row header"><span>序号</span><span>环境名称</span><span>代理</span><span>Cookie</span><span>UA</span><span>状态</span></div>
            <div className="row empty"><span>—</span><span>导入 MoreLogin TXT 后显示</span><span>—</span><span>—</span><span>—</span><span>未启动</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
