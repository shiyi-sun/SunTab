<script setup lang="ts">
import { APP_NAME, APP_VERSION } from '../../../shared/defaults';
import SettingsSection from '../SettingsSection.vue';

const shortcuts = [
  ['/ 或 Ctrl+K', '聚焦搜索框'],
  ['↑ / ↓', '选择本地图标结果'],
  ['Enter', '搜索、打开网址或图标'],
  ['Esc', '收起搜索建议/清空焦点'],
  ['Alt+Shift+S', '打开快速添加（当前页）'],
  ['点击时钟', '切换极简模式'],
];
</script>

<template>
  <SettingsSection title="关于" description="本地优先的个人新标签页。">
    <div class="about-card">
      <div class="about-brand">
        <span class="about-mark" aria-hidden="true"></span>
        <div>
          <strong>{{ APP_NAME }}</strong>
          <span>v{{ APP_VERSION }}</span>
        </div>
      </div>
      <p>
        配置、壁纸与图标数据保存在本机浏览器；只有开启“必应每日”或添加自动图标时才会访问相应网站。
      </p>
      <div class="about-author">
        <span>公众号：</span>
        <strong>十一营养师</strong>
      </div>
    </div>

    <div class="about-block">
      <h4>快捷键</h4>
      <div v-for="[key, action] in shortcuts" :key="key" class="shortcut-row">
        <kbd>{{ key }}</kbd>
        <span>{{ action }}</span>
      </div>
    </div>

    <div class="about-block">
      <h4>数据位置</h4>
      <p>设置与导航：chrome.storage.local；壁纸与图标文件：IndexedDB；首屏快照：localStorage。</p>
    </div>
  </SettingsSection>
</template>

<style scoped>
.about-card {
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.about-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-mark {
  position: relative;
  display: block;
  width: 38px;
  height: 38px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-hover);
}

.about-mark::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffd166;
  box-shadow: 0 0 14px rgba(255, 209, 102, 0.8);
  content: '';
  transform: translate(-50%, -50%);
}

.about-brand div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-brand strong {
  font-size: 16px;
}

.about-brand span {
  color: var(--panel-muted);
  font-size: 11px;
}

.about-card p,
.about-block p {
  margin: 12px 0 0;
  color: var(--panel-muted);
  font-size: 12px;
  line-height: 1.7;
}

.about-author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--panel-border);
  color: var(--panel-muted);
  font-size: 12px;
}

.about-author strong {
  color: var(--panel-text);
  font-weight: 600;
}

.about-block {
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.about-block h4 {
  margin: 0 0 12px;
  color: var(--panel-text);
  font-size: 13px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  color: var(--panel-muted);
  font-size: 12px;
}

kbd {
  padding: 4px 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-hover);
  color: var(--panel-text);
  font-family: var(--font-mono);
  font-size: 10px;
}
</style>
