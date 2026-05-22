const { config } = require('../../utils/config');

Page({
  data: {
    playerName: '',
    loading: false,
    stats: null,
    errorText: '',
  },

  onLoad() {
    this.fetchStats();
  },

  onShow() {
    this.fetchStats();
  },

  onNameInput(event) {
    this.setData({ playerName: event.detail.value });
  },

  fetchStats() {
    this.setData({ loading: true, errorText: '' });
    wx.cloud.callFunction({
      name: 'gameService',
      data: {
        action: 'getStats',
      },
      success: (response) => {
        this.setData({ stats: response.result, loading: false });
      },
      fail: () => {
        this.setData({
          loading: false,
          errorText: '云函数统计接口不可用，请确认 envId 和云函数部署状态。',
        });
      },
    });
  },

  openGame() {
    const name = this.data.playerName.trim();
    const target = name
      ? `/pages/game/game?playerName=${encodeURIComponent(name)}`
      : '/pages/game/game';

    wx.navigateTo({ url: target });
  },
});
