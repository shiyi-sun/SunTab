import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'SunTab',
    description: '本地优先的个人新标签页',
    version: '0.2.9',
    // 固定扩展 ID；私钥在 keys/suntab-extension-key.pem，删改这里会让现有数据读不到。
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkvAcQeRauWhwfStyvhfa23FBQx8Cur6gbvp/R93DQ4xTXqjMIS5oBzQdO5cutdu2cJIsyBn+QprxK60sC4wQWCZoxFr7vdu0x3ZsVnYY2b4vZevLlIaX/cGLjYaxhJyalb6bWw482wXTFQ9QceKxboWskQiED9MwAkaj5xokPggxjZbwg+8+RCPHNRF5Qe4P5FA8NGOai/XXIT8LAl6Wvgk10nCyrgDM3cyZl/EFbOEhKwZXvVMgIyktQ7q/9jkKG7JhW6AdOBVc1Waw8fxnLFw6T+X3XfukK8B3PHhMKhWEYSi32INh1GyXHb5Tw+Yi4Q0v8v4OTSz1yNSvaozCxwIDAQAB',
    permissions: ['storage', 'unlimitedStorage', 'favicon', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: {
      default_title: 'SunTab',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: '打开 SunTab 快速添加',
      },
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
