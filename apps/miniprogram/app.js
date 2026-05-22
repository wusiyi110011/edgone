const { config } = require('./utils/config');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云能力，请使用较新的微信开发者工具。');
      return;
    }

    wx.cloud.init({
      env: config.envId,
      traceUser: true,
    });
  },
});
