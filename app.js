const repository = require("./services/repository");
const realtime = require("./services/realtime");
const workStore = require("./store/work-store");

App({
  globalData: {
    caregiver: null,
    networkOnline: true,
    realtimeConnected: false
  },

  onLaunch() {
    const caregiver = repository.getCaregiverProfile();
    this.globalData.caregiver = caregiver;
    workStore.initialize({ caregiver });
    this.unsubscribeRealtime = realtime.on(event => {
      workStore.handleRealtimeEvent(event);
      if (event.type === "connection") this.globalData.realtimeConnected = Boolean(event.connected);
    });
    this.connectRealtime();

    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange(({ isConnected }) => {
        this.globalData.networkOnline = isConnected;
        workStore.setState({ networkOnline: isConnected });
        if (isConnected) this.connectRealtime();
      });
    }
  },

  onShow() {
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: ({ networkType }) => {
          const networkOnline = networkType !== "none";
          this.globalData.networkOnline = networkOnline;
          workStore.setState({ networkOnline });
          if (networkOnline) this.connectRealtime();
        }
      });
    }
  },

  connectRealtime() {
    if (!realtime.isEnabled() || !this.globalData.networkOnline) return Promise.resolve(false);
    return realtime.connect().then(() => true).catch(() => false);
  }
});
