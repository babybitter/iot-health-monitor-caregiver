const repository = require("./services/repository");
const workStore = require("./store/work-store");

App({
  globalData: {
    caregiver: null,
    selectedPatientId: "",
    networkOnline: true,
    realtimeConnected: false
  },

  onLaunch() {
    const account = repository.getCaregiverProfile();
    const selectedPatientId = repository.getSelectedPatientId();
    this.globalData.caregiver = account;
    this.globalData.selectedPatientId = selectedPatientId;
    workStore.initialize({ caregiver: account, selectedPatientId });

    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange(({ isConnected }) => {
        this.globalData.networkOnline = isConnected;
        workStore.setState({ networkOnline: isConnected });
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
        }
      });
    }
  }
});

